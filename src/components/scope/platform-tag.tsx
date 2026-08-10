import { Facebook, Instagram, MessageCircle, Music2, Twitter, Youtube } from "lucide-react";
import { PLATFORM_META, type Platform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const ICONS = {
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  x: Twitter,
  reddit: MessageCircle,
} as const;

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = ICONS[platform];
  return <Icon className={cn("size-3.5", className)} style={{ color: PLATFORM_META[platform].colorVar }} />;
}

export function PlatformTag({
  platform,
  showLabel = true,
  className,
}: {
  platform: Platform;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs",
        className,
      )}
    >
      <PlatformIcon platform={platform} />
      {showLabel && <span className="font-mono tracking-tight">{meta.label}</span>}
    </span>
  );
}