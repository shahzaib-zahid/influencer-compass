import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, ShieldAlert, Layers, Gauge } from "lucide-react";
import { PLATFORMS, PLATFORM_META } from "@/lib/platforms";
import { PlatformTag } from "@/components/scope/platform-tag";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InfluencerScope — Cross-platform influencer discovery" },
      {
        name: "description",
        content:
          "Search any niche and get ranked influencers across YouTube, Instagram, TikTok, X, Reddit and Facebook, with computed engagement rates, top posts and multi-platform matching.",
      },
      { property: "og:title", content: "InfluencerScope — Cross-platform influencer discovery" },
      {
        property: "og:description",
        content:
          "A research terminal for recruiters and brands: verified metrics, top-performing content, and creators active on multiple platforms at once.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Gauge,
    title: "Metrics we compute ourselves",
    body: "Engagement rate is derived from scraped post data — (avg likes + comments) / audience — not taken on trust from a scraper.",
  },
  {
    icon: Layers,
    title: "Multi-platform creators",
    body: "Handle, name and bio-link matching surfaces creators active on two or more platforms, always with a confidence level.",
  },
  {
    icon: ShieldAlert,
    title: "Built for partial failure",
    body: "Each platform scrapes in its own throttled job. If one degrades, the rest of the search still lands.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">InfluencerScope</span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
        <p className="label-xs">Cross-platform influencer intelligence</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Type a niche. Get the creators who own it.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          InfluencerScope scrapes six platforms in parallel jobs, computes verified engagement metrics
          from real post data, and flags the creators who are big on more than one network — the
          highest-value recruiting targets.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link to="/auth">Open the terminal</Link>
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-1.5">
          {PLATFORMS.map((platform) => (
            <PlatformTag key={platform} platform={platform} />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-3 px-6 pb-16 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="panel p-4">
            <feature.icon className="size-4 text-primary" />
            <h2 className="mt-2 text-sm font-semibold">{feature.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <p className="label-xs">Source reliability, stated up front</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {PLATFORMS.map((platform) => (
            <div key={platform} className="panel flex items-start gap-3 p-3">
              <PlatformTag platform={platform} showLabel={false} />
              <div>
                <dt className="font-mono text-xs">
                  {PLATFORM_META[platform].label}
                  <span className="ml-2 text-muted-foreground">{PLATFORM_META[platform].reliability}</span>
                </dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  {PLATFORM_META[platform].reliabilityNote}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          InfluencerScope aggregates publicly visible profile data. Use it in line with each
          platform&apos;s terms of service and the data-privacy law that applies in your jurisdiction.
        </p>
      </section>
    </div>
  );
}
