import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/scope/app-shell";
import { PlatformTag } from "@/components/scope/platform-tag";
import { PLATFORM_META, type Platform } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Scraping settings — InfluencerScope" },
      {
        name: "description",
        content:
          "Configure which Apify actor powers each platform, per-platform result limits, and credit cost estimates for InfluencerScope.",
      },
      { property: "og:title", content: "Scraping settings — InfluencerScope" },
      {
        property: "og:description",
        content: "Swap Apify actors per platform and tune result limits and cost estimates.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .order("reliability");
      if (error) throw error;
      return data;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is_admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  const save = useMutation({
    mutationFn: async (row: {
      platform: Platform;
      actor_id: string;
      max_results: number;
      credits_per_result: number;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          actor_id: row.actor_id,
          max_results: row.max_results,
          credits_per_result: row.credits_per_result,
          enabled: row.enabled,
        })
        .eq("platform", row.platform);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Platform settings updated");
      queryClient.invalidateQueries({ queryKey: ["platform_settings"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Only admins can change these settings"),
  });

  return (
    <AppShell email={user.email}>
      <div className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="font-mono text-lg font-semibold tracking-tight">Scraping settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apify actor quality changes over time — swap the actor per platform without touching code.
        </p>

        <div className="panel mt-5 flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-sm">Apify is connected through your workspace connection.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scrape runs are billed to that Apify account. Every batch stores its actor ID, run ID and
              timestamp so bad data can be traced back to its source run.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <div className="panel mt-3 flex items-start gap-3 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              You are signed in as a standard user, so actor configuration is read-only. An admin can
              change these values.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2">
          {isLoading && <Loader2 className="size-4 animate-spin text-primary" />}
          {settings?.map((row) => (
            <form
              key={row.platform}
              className="panel grid gap-3 p-3 md:grid-cols-[150px_1fr_90px_110px_auto] md:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                save.mutate({
                  platform: row.platform as Platform,
                  actor_id: String(form.get("actor_id") ?? "").trim(),
                  max_results: Number(form.get("max_results")) || 30,
                  credits_per_result: Number(form.get("credits_per_result")) || 0.05,
                  enabled: form.get("enabled") === "on",
                });
              }}
            >
              <div>
                <PlatformTag platform={row.platform as Platform} />
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  {PLATFORM_META[row.platform as Platform].reliabilityNote}
                </p>
              </div>
              <label className="space-y-1">
                <span className="label-xs">Apify actor ID</span>
                <Input
                  name="actor_id"
                  defaultValue={row.actor_id}
                  disabled={!isAdmin}
                  className="bg-surface-2 font-mono text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="label-xs">Max</span>
                <Input
                  name="max_results"
                  defaultValue={row.max_results}
                  disabled={!isAdmin}
                  className="bg-surface-2 tabular text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="label-xs">Credits / result</span>
                <Input
                  name="credits_per_result"
                  defaultValue={row.credits_per_result}
                  disabled={!isAdmin}
                  className="bg-surface-2 tabular text-xs"
                />
              </label>
              <div className="flex items-center gap-3">
                <Switch name="enabled" defaultChecked={row.enabled} disabled={!isAdmin} />
                <Button type="submit" size="sm" variant="outline" disabled={!isAdmin || save.isPending}>
                  Save
                </Button>
              </div>
            </form>
          ))}
        </div>

        <div className="panel mt-6 p-4">
          <p className="label-xs">Compliance notice</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            InfluencerScope aggregates publicly visible profile data at scale. Use it in line with each
            platform&apos;s terms of service and the data-privacy law that applies in your jurisdiction.
            Instagram, Facebook, TikTok and X actively restrict scraping — treat their results as
            best-effort and expect occasional gaps.
          </p>
        </div>
      </div>
    </AppShell>
  );
}