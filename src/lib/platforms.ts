export type Platform = "instagram" | "facebook" | "tiktok" | "x" | "reddit" | "youtube";

export const PLATFORMS: Platform[] = [
  "youtube",
  "instagram",
  "tiktok",
  "x",
  "reddit",
  "facebook",
];

export type PlatformMeta = {
  id: Platform;
  label: string;
  audienceLabel: string;
  contentLabel: string;
  colorVar: string;
  reliability: "high" | "medium" | "low";
  reliabilityNote: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    audienceLabel: "Subscribers",
    contentLabel: "Videos",
    colorVar: "var(--yt)",
    reliability: "high",
    reliabilityNote: "Most stable source — weighted highest in match confidence.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    audienceLabel: "Followers",
    contentLabel: "Posts",
    colorVar: "var(--ig)",
    reliability: "medium",
    reliabilityNote: "Actively fights scraping — partial failures are expected.",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    audienceLabel: "Followers",
    contentLabel: "Videos",
    colorVar: "var(--tt)",
    reliability: "medium",
    reliabilityNote: "Volatile access; results can be incomplete.",
  },
  x: {
    id: "x",
    label: "X",
    audienceLabel: "Followers",
    contentLabel: "Posts",
    colorVar: "var(--xx)",
    reliability: "low",
    reliabilityNote: "Least reliable source since the API lockdown.",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    audienceLabel: "Karma",
    contentLabel: "Posts",
    colorVar: "var(--rd)",
    reliability: "high",
    reliabilityNote: "No followers — ranked by karma and post engagement.",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    audienceLabel: "Followers",
    contentLabel: "Posts",
    colorVar: "var(--fb)",
    reliability: "low",
    reliabilityNote: "Limited public data and volatile access.",
  },
};

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(2)}%`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}