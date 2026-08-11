import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, History, RefreshCw, Radar, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteSearch, runPlatformJob, startSearch, stopSearch } from "@/lib/scope.functions";
import { AppShell } from "@/components/scope/app-shell";
import { SearchPanel, type SearchFormValues } from "@/components/scope/search-panel";
import { PlatformNotice, PlatformStatusStrip, type JobRow } from "@/components/scope/platform-status";
import { ResultsTable, type ProfileRow, type SortKey } from "@/components/scope/results-table";
import { PlatformTag } from "@/components/scope/platform-tag";
import { MatchPanel } from "@/components/scope/match-panel";
import { PLATFORM_META, timeAgo, type Platform } from "@/lib/platforms";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const begin = useServerFn(startSearch);
  const runJob = useServerFn(runPlatformJob);
  const halt = useServerFn(stopSearch);
  const removeSearch = useServerFn(deleteSearch);

  const [searchId, setSearchId] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform | "all" | null>("all");
  const [sortKey, setSortKey] = useState<SortKey>("follower_count");
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);
  const stopRef = useRef(false);

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
          "id, platform, username, display_name, profile_url, follower_count, post_count, bio, verified, engagement_rate, posting_frequency, relevance_score, niche_query, last_scraped_at",
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
      stopRef.current = false;
      setBusy(true);
      try {
        for (const platform of platforms) {
          if (stopRef.current) break;
          try {
            await runJob({ data: { searchId: id, platform } });
          } catch (error) {
            console.error(platform, error);
          }
          await queryClient.invalidateQueries({ queryKey: ["search_jobs", id] });
          await queryClient.invalidateQueries({ queryKey: ["profiles", id] });
          if (stopRef.current) break;
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
      setActivePlatform("all");
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

  async function handleStop() {
    if (!searchId) return;
    stopRef.current = true;
    try {
      await halt({ data: { searchId } });
      await queryClient.invalidateQueries({ queryKey: ["search_jobs", searchId] });
      toast.info("Scraping stopped — results collected so far are saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop the run");
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeSearch({ data: { searchId: id } });
      if (searchId === id) setSearchId(null);
      await queryClient.invalidateQueries({ queryKey: ["recent_searches", user.id] });
      toast.success("Search and its scraped data deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this search");
    }
  }

  const filters = (search?.filters_json ?? {}) as { platforms?: Platform[] };
  const jobList = jobs ?? [];
  const platformsInSearch = filters.platforms ?? jobList.map((job) => job.platform);
  const current = activePlatform ?? "all";
  const currentJob = current === "all" ? undefined : jobList.find((job) => job.platform === current);

  const rows = useMemo(() => {
    const list = (profiles ?? []).filter((row) => current === "all" || row.platform === current);
    return [...list].sort((a, b) => (Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0)));
  }, [profiles, current, sortKey]);

  function handleExport() {
    if (!rows.length) return;
    const csv = toCsv(rows as unknown as Record<string, unknown>[], [
      { key: "platform", label: "Platform" },
      { key: "username", label: "Username" },
      { key: "display_name", label: "Display name" },
      { key: "niche_query", label: "Niche / keywords" },
      { key: "follower_count", label: "Audience" },
      { key: "post_count", label: "Content count" },
      { key: "engagement_rate", label: "Engagement rate %" },
      { key: "posting_frequency", label: "Posts per week" },
      { key: "relevance_score", label: "Relevance" },
      { key: "verified", label: "Verified" },
      { key: "profile_url", label: "Profile URL" },
      { key: "bio", label: "Bio" },
      { key: "last_scraped_at", label: "Scraped at" },
    ]);
    const slug = (search?.niche_query ?? "influencerscope").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCsv(`${slug}-${current}.csv`, csv);
  }

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
                <div
                  key={item.id}
                  className="group flex items-center gap-1 rounded-md transition-colors hover:bg-sidebar-accent"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchId(item.id);
                      setActivePlatform("all");
                    }}
                    className="min-w-0 flex-1 px-2 py-1.5 text-left text-xs"
                  >
                    <span className="block truncate font-mono">{item.niche_query}</span>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete search ${item.niche_query}`}
                    onClick={() => handleDelete(item.id)}
                    className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
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
              <div className="flex flex-wrap items-center gap-2">
                {busy && (
                  <Button variant="destructive" size="sm" onClick={handleStop}>
                    <Square className="size-3.5" /> Stop scraping
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={!rows.length} onClick={handleExport}>
                  <Download className="size-3.5" /> Export CSV
                </Button>
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
                <Button variant="ghost" size="sm" onClick={() => searchId && handleDelete(searchId)}>
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePlatform("all")}
                  className={cn(
                    "rounded-md border border-border px-2.5 py-1 font-mono text-xs transition-colors hover:border-ring/50",
                    current === "all" && "border-primary/60 bg-surface-2 text-primary",
                  )}
                >
                  All platforms · {profiles?.length ?? 0}
                </button>
              </div>
              <PlatformStatusStrip
                jobs={jobList}
                activePlatform={current}
                onSelect={(platform) => setActivePlatform(platform)}
              />
            </div>

            {current && (
              <div className="mt-5">
                {current !== "all" && (
                  <div className="mb-2 flex items-center gap-2">
                    <PlatformTag platform={current} />
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_META[current].reliabilityNote}
                    </span>
                  </div>
                )}
                {rows.length > 0 ? (
                  <ResultsTable
                    platform={current === "all" ? (rows[0]?.platform ?? "youtube") : current}
                    rows={rows}
                    sortKey={sortKey}
                    onSort={(key) => setSortKey(key)}
                    showPlatform={current === "all"}
                  />
                ) : currentJob ? (
                  <PlatformNotice job={currentJob} />
                ) : (
                  <p className="rounded-md border border-border bg-surface px-3 py-6 text-sm text-muted-foreground">
                    No creators stored for this search yet.
                  </p>
                )}
              </div>
            )}

            <MatchPanel searchId={searchId} />
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