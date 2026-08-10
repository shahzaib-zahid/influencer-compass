import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw, Radar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runPlatformJob, startSearch } from "@/lib/scope.functions";
import { AppShell } from "@/components/scope/app-shell";
import { SearchPanel, type SearchFormValues } from "@/components/scope/search-panel";
import { PlatformNotice, PlatformStatusStrip, type JobRow } from "@/components/scope/platform-status";
import { ResultsTable, type ProfileRow, type SortKey } from "@/components/scope/results-table";
import { PlatformTag } from "@/components/scope/platform-tag";
import { PLATFORM_META, timeAgo, type Platform } from "@/lib/platforms";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Discovery terminal — InfluencerScope" },
      {
        name: "description",
        content:
          "Search any niche and get ranked, filterable influencer results across YouTube, Instagram, TikTok, X, Reddit and Facebook with verified metrics and top posts.",
      },
      { property: "og:title", content: "Discovery terminal — InfluencerScope" },
      {
        property: "og:description",
        content: "Cross-platform influencer discovery with computed engagement rates and top content.",
      },
    ],
  }),
  component: Dashboard;
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const begin = useServerFn(startSearch);
  const runJob = useServerFn(runPlatformJob);

  const [searchId, setSearchId] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("follower_count");
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("platform, credits_per_result, max_results, enabled");
      if (error) throw error;
      return data;
    },
  });

  const creditEstimates = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of settings ?? []) {
      map[row.platform] = Number(row.credits_per_result) * Number(row.max_results);
    }
    return map;
  }, [settings]);

  const { data: recent } = useQuery({
    queryKey: ["recent_searches", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("searches")
        .select("id, niche_query, created_at, filters_json, estimated_credits")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: search } = useQuery({
    queryKey: ["search", searchId],
    enabled: !!searchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("searches")
        .select("id, niche_query, created_at, filters_json, estimated_credits")
        .eq("id", searchId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["search_jobs", searchId],
    enabled: !!searchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_jobs")
        .select("platform, status, result_count, error_message, apify_run_id, actor_id")
        .eq("search_id", searchId!);
      if (error) throw error;
      return data as JobRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles", searchId],
    enabled: !!searchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_profiles")
        .select(
          "id, platform, username, display_name, profile_url, follower_count, post_count, bio, verified, engagement_rate, posting_frequency, relevance_score, last_scraped_at",
        )
        .eq("search_id", searchId!);
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  useEffect(() => {
    if (!searchId) return;
    const channel = supabase
      .channel(`search-${searchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "search_jobs", filter: `search_id=eq.${searchId}` },
        () => queryClient.invalidateQueries({ queryKey: ["search_jobs", searchId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_profiles", filter: `search_id=eq.${searchId}` },
        () => queryClient.invalidateQueries({ queryKey: ["profiles", searchId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchId, queryClient]);

  /** Throttled queue: one platform actor run at a time, never all at once. */
  const drainQueue = useCallback(
    async (id: string, platforms: Platform[]) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setBusy(true);
      try {
        for (const platform of platforms) {
          try {
            await runJob({ data: { searchId: id, platform } });
          } catch (error) {
            console.error(platform, error);
          }
          await queryClient.invalidateQueries({ queryKey: ["search_jobs", id] });
          await queryClient.invalidateQueries({ queryKey: ["profiles", id] });
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      } finally {
        runningRef.current = false;
        setBusy(false);
      }
    },
    [runJob, queryClient],
  );

  async function handleSubmit(values: SearchFormValues, forceRefresh = false) {
    setBusy(true);
    try {
      const result = await begin({ data: { ...values, forceRefresh } });
      setSearchId(result.searchId);
      setActivePlatform(values.platforms[0] ?? null);
      await queryClient.invalidateQueries({ queryKey: ["recent_searches", user.id] });
      if (result.cached) {
        toast.info(`Reusing cached results from ${timeAgo(result.createdAt)}`);
        setBusy(false);
        return;
      }
      void drainQueue(result.searchId, values.platforms);
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not start the search");
    }
  }

  const filters = (search?.filters_json ?? {}) as { platforms?: Platform[] };
  const jobList = jobs ?? [];
  const platformsInSearch = filters.platforms ?? jobList.map((job) => job.platform);
  const current = activePlatform ?? platformsInSearch[0] ?? null;
  const currentJob = jobList.find((job) => job.platform === current);

  const rows = useMemo(() => {
    const list = (profiles ?? []).filter((row) => row.platform === current);
    return [...list].sort((a, b) => (Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0)));
  }, [profiles, current, sortKey]);

  return (
    <AppShell
      email={user.email}
      sidebar={
        <div>
          <SearchPanel onSubmit={(values) => handleSubmit(values)} busy={busy} creditEstimates={creditEstimates} />
          <div className="border-t border-sidebar-border p-3">
            <p className="label-xs flex items-center gap-1.5">
              <History className="size-3" /> Recent searches
            </p>
            <div className="mt-2 space-y-1">
              {(recent ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearchId(item.id);
                    setActivePlatform(null);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-sidebar-accent"
                >
                  <span className="block truncate font-mono">{item.niche_query}</span>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                </button>
              ))}
              {!recent?.length && <p className="text-xs text-muted-foreground">No searches yet.</p>}
            </div>
          </div>
        </div>
      }
    >
      <div className="px-6 py-5">
        {!searchId ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-mono text-lg font-semibold tracking-tight">
                  {search?.niche_query ?? "…"}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Scraped {timeAgo(search?.created_at)} · est. {Number(search?.estimated_credits ?? 0).toFixed(2)}{" "}
                  Apify credits · {profiles?.length ?? 0} creators
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !search}
                onClick={() =>
                  search &&
                  handleSubmit(
                    {
                      query: search.niche_query,
                      platforms: platformsInSearch,
                      minFollowers: Number((search.filters_json as { minFollowers?: number }).minFollowers ?? 0),
                      region: null,
                      language: null,
                    },
                    true,
                  )
                }
              >
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>

            <div className="mt-4">
              <PlatformStatusStrip
                jobs={jobList}
                activePlatform={current}
                onSelect={(platform) => setActivePlatform(platform)}
              />
            </div>

            {current && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <PlatformTag platform={current} />
                  <span className="text-xs text-muted-foreground">
                    {PLATFORM_META[current].reliabilityNote}
                  </span>
                </div>
                {rows.length > 0 ? (
                  <ResultsTable
                    platform={current}
                    rows={rows}
                    sortKey={sortKey}
                    onSort={(key) => setSortKey(key)}
                  />
                ) : currentJob ? (
                  <PlatformNotice job={currentJob} />
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Radar className="size-8 text-primary" />
      <h1 className="mt-3 font-mono text-lg font-semibold tracking-tight">Run your first discovery</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Type a niche in the left panel — “trading”, “fitness”, “cooking” — pick your platforms, and
        InfluencerScope queues one scrape per platform and streams results in as each run finishes.
      </p>
    </div>
  );
}