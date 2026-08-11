import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_META, formatCount, formatRate, timeAgo, type Platform } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { PlatformTag } from "./platform-tag";

export type ProfileRow = {
  id: string;
  platform: Platform;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  follower_count: number | null;
  post_count: number | null;
  bio: string | null;
  verified: boolean;
  engagement_rate: number | null;
  posting_frequency: number | null;
  relevance_score: number | null;
  niche_query: string | null;
  last_scraped_at: string;
};

export type SortKey = "follower_count" | "engagement_rate" | "posting_frequency" | "relevance_score";

const COLUMNS: { key: SortKey; label: (p: Platform) => string }[] = [
  { key: "follower_count", label: (p) => PLATFORM_META[p].audienceLabel },
  { key: "engagement_rate", label: () => "Eng. rate" },
  { key: "posting_frequency", label: () => "Posts/wk" },
  { key: "relevance_score", label: () => "Relevance" },
];

export function ResultsTable({
  platform,
  rows,
  sortKey,
  onSort,
  showPlatform = false,
}: {
  platform: Platform;
  rows: ProfileRow[];
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  showPlatform?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const colSpan = showPlatform ? 11 : 10;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            <th className="w-8" />
            {showPlatform && <th className="px-3 py-2 text-left label-xs">Platform</th>}
            <th className="px-3 py-2 text-left label-xs">Creator</th>
            {COLUMNS.map((column) => (
              <th key={column.key} className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onSort(column.key)}
                  className={cn("label-xs hover:text-foreground", sortKey === column.key && "text-primary")}
                >
                  {column.label(platform)}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-right label-xs">{PLATFORM_META[platform].contentLabel}</th>
            <th className="px-3 py-2 text-left label-xs">Niche / keywords</th>
            <th className="px-3 py-2 text-left label-xs">Bio</th>
            <th className="px-3 py-2 text-right label-xs">Scraped</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr
                key={row.id}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2/60"
                onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              >
                <td className="pl-2 text-muted-foreground">
                  {expanded === row.id ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </td>
                {showPlatform && (
                  <td className="px-3 py-2">
                    <PlatformTag platform={row.platform} />
                  </td>
                )}
                <td className="max-w-[220px] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={row.profile_url ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(event) => event.stopPropagation()}
                      className="truncate font-mono text-xs text-primary hover:underline"
                    >
                      @{row.username}
                    </a>
                    {row.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{row.display_name ?? "—"}</p>
                </td>
                <td className="tabular px-3 py-2 text-right">{formatCount(row.follower_count)}</td>
                <td className="tabular px-3 py-2 text-right">{formatRate(row.engagement_rate)}</td>
                <td className="tabular px-3 py-2 text-right text-muted-foreground">
                  {row.posting_frequency ?? "—"}
                </td>
                <td className="tabular px-3 py-2 text-right text-muted-foreground">
                  {row.relevance_score ?? "—"}
                </td>
                <td className="tabular px-3 py-2 text-right text-muted-foreground">
                  {formatCount(row.post_count)}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 font-mono text-xs text-accent">
                  {row.niche_query ?? "—"}
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 text-xs text-muted-foreground">
                  {row.bio ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {timeAgo(row.last_scraped_at)}
                </td>
              </tr>
              {expanded === row.id && (
                <tr key={`${row.id}-posts`} className="border-b border-border bg-background/40">
                  <td colSpan={colSpan} className="p-3">
                    <TopPosts profileId={row.id} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPosts({ profileId }: { profileId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["posts", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, post_url, caption, like_count, comment_count, view_count, posted_at, thumbnail_url")
        .eq("platform_profile_id", profileId)
        .order("engagement_total", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="label-xs">Loading top posts…</p>;
  if (!data?.length) return <p className="label-xs">No post data captured for this creator.</p>;

  return (
    <div>
      <p className="label-xs mb-2">Top posts by engagement</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {data.map((post) => (
          <a
            key={post.id}
            href={post.post_url ?? "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="flex gap-2 rounded-md border border-border bg-surface p-2 transition-colors hover:border-primary/50"
          >
            {post.thumbnail_url ? (
              <img
                src={post.thumbnail_url}
                alt=""
                loading="lazy"
                className="size-16 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded bg-surface-2" />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs">{post.caption ?? "Untitled"}</p>
              <p className="tabular mt-1 text-[11px] text-muted-foreground">
                {formatCount(post.like_count)} likes · {formatCount(post.comment_count)} comments
                {post.view_count ? ` · ${formatCount(post.view_count)} views` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {post.posted_at ? new Date(post.posted_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}