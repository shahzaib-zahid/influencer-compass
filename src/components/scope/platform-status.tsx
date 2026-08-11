import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { PLATFORM_META, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "./platform-tag";
import { cn } from "@/lib/utils";

export type JobRow = {
  platform: Platform;
  status: "queued" | "running" | "succeeded" | "failed" | "partial";
  result_count: number;
  error_message: string | null;
  apify_run_id: string | null;
  actor_id: string | null;
};

const STATUS = {
  queued: { icon: Clock, className: "text-muted-foreground", text: "Queued" },
  running: { icon: Loader2, className: "text-primary animate-spin", text: "Searching…" },
  succeeded: { icon: CheckCircle2, className: "text-success", text: "Done" },
  partial: { icon: AlertTriangle, className: "text-warning", text: "No usable data" },
  failed: { icon: XCircle, className: "text-destructive", text: "Unavailable" },
} as const;

export function PlatformStatusStrip({
  jobs,
  activePlatform,
  onSelect,
}: {
  jobs: JobRow[];
  activePlatform: Platform | "all" | null;
  onSelect: (platform: Platform) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => {
        const status = STATUS[job.status];
        const Icon = status.icon;
        return (
          <button
            key={job.platform}
            type="button"
            onClick={() => onSelect(job.platform)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-ring/50",
              activePlatform === job.platform && "border-primary/60 bg-surface-2",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <PlatformIcon platform={job.platform} />
              <span className="truncate font-mono text-xs">{PLATFORM_META[job.platform].label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="tabular text-xs text-muted-foreground">
                {job.status === "succeeded" ? job.result_count : status.text}
              </span>
              <Icon className={cn("size-3.5", status.className)} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PlatformNotice({ job }: { job: JobRow }) {
  if (job.status === "running" || job.status === "queued") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Searching {PLATFORM_META[job.platform].label}… results appear as the run completes.
      </div>
    );
  }
  if (job.status === "failed" || job.status === "partial") {
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-4">
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="size-4" />
          {PLATFORM_META[job.platform].label} data temporarily unavailable
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{job.error_message ?? "The scrape returned nothing usable."}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          actor {job.actor_id ?? "—"} · run {job.apify_run_id ?? "—"}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-6 text-sm text-muted-foreground">
      No creators matched your filters on {PLATFORM_META[job.platform].label}.
    </div>
  );
}