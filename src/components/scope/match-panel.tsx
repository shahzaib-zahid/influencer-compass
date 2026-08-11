import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Link2, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildMatches, decideMatch } from "@/lib/scope.functions";
import { PlatformTag } from "./platform-tag";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCount, type Platform } from "@/lib/platforms";

type MatchProfile = {
  id: string;
  platform: Platform;
  username: string;
  display_name: string | null;
  follower_count: number | null;
  profile_url: string | null;
};

type MatchRow = {
  id: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
  confirmed_by_user: boolean | null;
  a: MatchProfile | null;
  b: MatchProfile | null;
};

const CONFIDENCE_STYLE = {
  high: "border-success/50 text-success",
  medium: "border-warning/50 text-warning",
  low: "border-border text-muted-foreground",
} as const;

export function MatchPanel({ searchId }: { searchId: string }) {
  const queryClient = useQueryClient();
  const build = useServerFn(buildMatches);
  const decide = useServerFn(decideMatch);
  const [scanning, setScanning] = useState(false);

  const { data: profileIds } = useQuery({
    queryKey: ["match_profile_ids", searchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_profiles")
        .select("id")
        .eq("search_id", searchId);
      if (error) throw error;
      return data.map((row) => row.id as string);
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["matches", searchId, profileIds?.length ?? 0],
    enabled: !!profileIds?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_matches")
        .select(
          "id, confidence, score, reasons, confirmed_by_user, a:platform_profile_id_a(id, platform, username, display_name, follower_count, profile_url), b:platform_profile_id_b(id, platform, username, display_name, follower_count, profile_url)",
        )
        .in("platform_profile_id_a", profileIds!)
        .order("score", { ascending: false });
      if (error) throw error;
      return data as unknown as MatchRow[];
    },
  });

  const pending = useMemo(
    () => (matches ?? []).filter((match) => match.confirmed_by_user === null),
    [matches],
  );
  const decided = useMemo(
    () => (matches ?? []).filter((match) => match.confirmed_by_user !== null),
    [matches],
  );

  async function runScan() {
    setScanning(true);
    try {
      const result = await build({ data: { searchId } });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      toast.success(
        result.created ? `${result.created} new cross-platform candidates found` : "No new candidates found",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Match scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function vote(matchId: string, confirmed: boolean) {
    try {
      await decide({ data: { matchId, confirmed } });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your decision");
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-sm font-semibold">
            <Users className="size-4 text-primary" /> Cross-platform creator matching
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Candidate pairs judged on handle, display name and shared bio links. Confirm to link them into
            one creator identity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
          {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
          Scan for matches
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {pending.map((match) => (
          <MatchCard key={match.id} match={match} onVote={vote} />
        ))}
        {!pending.length && (
          <p className="py-3 text-xs text-muted-foreground">
            No candidate pairs awaiting review. Run a scan after scraping more platforms.
          </p>
        )}
      </div>

      {decided.length > 0 && (
        <div className="mt-4">
          <p className="label-xs">Reviewed ({decided.length})</p>
          <div className="mt-2 space-y-2">
            {decided.map((match) => (
              <MatchCard key={match.id} match={match} onVote={vote} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match,
  onVote,
}: {
  match: MatchRow;
  onVote: (matchId: string, confirmed: boolean) => void;
}) {
  if (!match.a || !match.b) return null;
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Side profile={match.a} />
          <span className="text-xs text-muted-foreground">↔</span>
          <Side profile={match.b} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "tabular rounded border px-1.5 py-0.5 text-[11px] uppercase",
              CONFIDENCE_STYLE[match.confidence],
            )}
          >
            {match.confidence} · {match.score}
          </span>
          {match.confirmed_by_user === null ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onVote(match.id, true)}>
                <Check className="size-3.5" /> Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onVote(match.id, false)}>
                <X className="size-3.5" /> Reject
              </Button>
            </>
          ) : (
            <span
              className={cn(
                "text-[11px]",
                match.confirmed_by_user ? "text-success" : "text-muted-foreground",
              )}
            >
              {match.confirmed_by_user ? "Confirmed same creator" : "Rejected"}
            </span>
          )}
        </div>
      </div>
      {match.reasons.length > 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{match.reasons.join(" · ")}</p>
      )}
    </div>
  );
}

function Side({ profile }: { profile: MatchProfile }) {
  return (
    <span className="flex items-center gap-1.5">
      <PlatformTag platform={profile.platform} />
      <a
        href={profile.profile_url ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        className="font-mono text-xs text-primary hover:underline"
      >
        @{profile.username}
      </a>
      <span className="tabular text-[11px] text-muted-foreground">
        {formatCount(profile.follower_count)}
      </span>
    </span>
  );
}