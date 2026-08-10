import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/platforms";
import { PlatformIcon } from "./platform-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type SearchFormValues = {
  query: string;
  platforms: Platform[];
  minFollowers: number;
  region: string | null;
  language: string | null;
};

export function SearchPanel({
  onSubmit,
  busy,
  creditEstimates,
}: {
  onSubmit: (values: SearchFormValues) => void;
  busy: boolean;
  creditEstimates: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([...PLATFORMS]);
  const [minFollowers, setMinFollowers] = useState("5000");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("");

  const estimate = platforms.reduce((sum, p) => sum + (creditEstimates[p] ?? 1.5), 0);

  function toggle(platform: Platform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  return (
    <form
      className="space-y-4 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim().length < 2 || platforms.length === 0) return;
        onSubmit({
          query: query.trim(),
          platforms,
          minFollowers: Number(minFollowers) || 0,
          region: region.trim() || null,
          language: language.trim() || null,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="niche" className="label-xs">
          Niche / keyword
        </Label>
        <Input
          id="niche"
          value={query}
          maxLength={80}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="trading, forex, day trading"
          className="bg-surface font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="label-xs">Platforms</Label>
        <div className="grid grid-cols-2 gap-1">
          {PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs transition-colors hover:border-ring/40"
            >
              <Checkbox
                checked={platforms.includes(platform)}
                onCheckedChange={() => toggle(platform)}
                className="size-3.5"
              />
              <PlatformIcon platform={platform} />
              <span className="truncate">{PLATFORM_META[platform].label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="minf" className="label-xs">
            Min audience
          </Label>
          <Input
            id="minf"
            inputMode="numeric"
            value={minFollowers}
            onChange={(event) => setMinFollowers(event.target.value.replace(/[^0-9]/g, ""))}
            className="bg-surface tabular text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region" className="label-xs">
            Region
          </Label>
          <Input
            id="region"
            value={region}
            maxLength={60}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="best effort"
            className="bg-surface text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lang" className="label-xs">
          Language
        </Label>
        <Input
          id="lang"
          value={language}
          maxLength={40}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="en, es, ur…"
          className="bg-surface text-sm"
        />
      </div>

      <div className="rounded-md border border-border bg-surface px-2.5 py-2">
        <p className="label-xs">Estimated cost</p>
        <p className="tabular mt-0.5 text-sm text-accent">≈ {estimate.toFixed(2)} Apify credits</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Cached results under 24h are reused instead of re-scraping.
        </p>
      </div>

      <Button type="submit" disabled={busy || query.trim().length < 2} className="w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        {busy ? "Scraping…" : "Run discovery"}
      </Button>
    </form>
  );
}