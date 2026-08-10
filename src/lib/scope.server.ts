import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "./platforms";
import {
  buildActorInput,
  computeMetrics,
  engagementOf,
  normalizeItems,
  runActor,
} from "./apify.server";

type DB = SupabaseClient<any, "public", any>;

const CACHE_HOURS = 24;

export type SearchFilters = {
  query: string;
  platforms: Platform[];
  minFollowers: number;
  region: string | null;
  language: string | null;
  forceRefresh: boolean;
};

export async function createSearchRecord(supabase: DB, userId: string, input: SearchFilters) {
  const { query, platforms, forceRefresh } = input;

  if (!forceRefresh) {
    const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
    const { data: cached } = await supabase
      .from("searches")
      .select("id, created_at, filters_json")
      .eq("user_id", userId)
      .ilike("niche_query", query)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    const hit = cached?.[0];
    if (hit) {
      const cachedPlatforms = (hit.filters_json?.platforms ?? []) as string[];
      const covered = platforms.every((p) => cachedPlatforms.includes(p));
      if (covered) {
        return { searchId: hit.id as string, cached: true, createdAt: hit.created_at as string };
      }
    }
  }

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("platform, credits_per_result, max_results, enabled")
    .in("platform", platforms);

  const estimated = (settings ?? []).reduce(
    (sum, row) => sum + Number(row.credits_per_result) * Number(row.max_results),
    0,
  );

  const { data: search, error } = await supabase
    .from("searches")
    .insert({
      user_id: userId,
      niche_query: query,
      filters_json: {
        platforms,
        minFollowers: input.minFollowers,
        region: input.region,
        language: input.language,
      },
      status: "queued",
      estimated_credits: Number(estimated.toFixed(2)),
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);

  const enabled = new Set((settings ?? []).filter((s) => s.enabled).map((s) => s.platform));
  const jobs = platforms.map((platform) => ({
    search_id: search.id,
    user_id: userId,
    platform,
    status: enabled.has(platform) ? "queued" : "failed",
    error_message: enabled.has(platform) ? null : "Platform disabled in settings",
  }));
  const { error: jobError } = await supabase.from("search_jobs").insert(jobs);
  if (jobError) throw new Error(jobError.message);

  return { searchId: search.id as string, cached: false, createdAt: search.created_at as string };
}

export async function executePlatformJob(
  supabase: DB,
  userId: string,
  searchId: string,
  platform: Platform,
) {
  const { data: search, error: searchError } = await supabase
    .from("searches")
    .select("id, niche_query, filters_json")
    .eq("id", searchId)
    .single();
  if (searchError || !search) throw new Error("Search not found");

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("actor_id, max_results, enabled")
    .eq("platform", platform)
    .single();

  if (!settings || !settings.enabled) {
    await supabase
      .from("search_jobs")
      .update({
        status: "failed",
        error_message: "Platform disabled in settings",
        finished_at: new Date().toISOString(),
      })
      .eq("search_id", searchId)
      .eq("platform", platform);
    return { platform, status: "failed" as const, count: 0 };
  }

  await supabase
    .from("search_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      actor_id: settings.actor_id,
      error_message: null,
    })
    .eq("search_id", searchId)
    .eq("platform", platform);

  const query = search.niche_query as string;
  const minFollowers = Number(search.filters_json?.minFollowers ?? 0);
  const maxResults = Number(settings.max_results ?? 30);

  try {
    const { items, runId, datasetId } = await runActor(
      settings.actor_id as string,
      buildActorInput(platform, query, maxResults),
    );

    const profiles = normalizeItems(platform, items)
      .map((profile) => ({ profile, metrics: computeMetrics(profile, query) }))
      .filter(({ profile }) => (profile.follower_count ?? 0) >= minFollowers)
      .sort((a, b) => (b.profile.follower_count ?? 0) - (a.profile.follower_count ?? 0))
      .slice(0, maxResults);

    if (profiles.length === 0) {
      await supabase
        .from("search_jobs")
        .update({
          status: "partial",
          error_message: "Scrape returned no usable creators for this niche",
          apify_run_id: runId,
          apify_dataset_id: datasetId,
          result_count: 0,
          finished_at: new Date().toISOString(),
        })
        .eq("search_id", searchId)
        .eq("platform", platform);
      return { platform, status: "partial" as const, count: 0 };
    }

    for (const { profile, metrics } of profiles) {
      const { data: inserted, error: insertError } = await supabase
        .from("platform_profiles")
        .insert({
          user_id: userId,
          search_id: searchId,
          platform,
          username: profile.username,
          display_name: profile.display_name,
          profile_url: profile.profile_url,
          avatar_url: profile.avatar_url,
          follower_count: profile.follower_count,
          post_count: profile.post_count,
          bio: profile.bio,
          bio_links: profile.bio_links,
          verified: profile.verified,
          region: profile.region,
          language: profile.language,
          niche_query: query,
          actor_id: settings.actor_id,
          apify_run_id: runId,
          last_scraped_at: new Date().toISOString(),
          ...metrics,
        })
        .select("id")
        .single();
      if (insertError || !inserted) continue;

      const posts = profile.posts.slice(0, 8).map((post) => ({
        user_id: userId,
        platform_profile_id: inserted.id,
        post_url: post.post_url,
        caption: post.caption,
        like_count: post.like_count,
        comment_count: post.comment_count,
        view_count: post.view_count,
        share_count: post.share_count,
        engagement_total: engagementOf(post),
        posted_at: post.posted_at,
        thumbnail_url: post.thumbnail_url,
      }));
      if (posts.length) await supabase.from("posts").insert(posts);

      await supabase.from("metric_snapshots").upsert(
        {
          user_id: userId,
          platform_profile_id: inserted.id,
          follower_count: profile.follower_count,
          post_count: profile.post_count,
          engagement_rate: metrics.engagement_rate,
        },
        { onConflict: "platform_profile_id,snapshot_date" },
      );
    }

    await supabase
      .from("search_jobs")
      .update({
        status: "succeeded",
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        result_count: profiles.length,
        finished_at: new Date().toISOString(),
      })
      .eq("search_id", searchId)
      .eq("platform", platform);

    return { platform, status: "succeeded" as const, count: profiles.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scrape failure";
    console.error(`[${platform}] scrape failed:`, message);
    await supabase
      .from("search_jobs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("search_id", searchId)
      .eq("platform", platform);
    return { platform, status: "failed" as const, count: 0 };
  }
}