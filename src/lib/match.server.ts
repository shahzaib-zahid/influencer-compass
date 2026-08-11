import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, "public", any>;

type Candidate = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  bio_links: string[] | null;
};

function normalizeHandle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hosts(links: string[] | null): Set<string> {
  const set = new Set<string>();
  for (const link of links ?? []) {
    try {
      set.add(new URL(link.startsWith("http") ? link : `https://${link}`).hostname.replace(/^www\./, ""));
    } catch {
      /* ignore malformed link */
    }
  }
  return set;
}

/** Scores a pair of profiles from different platforms as the same human. */
function scorePair(a: Candidate, b: Candidate) {
  const reasons: string[] = [];
  let score = 0;

  const ha = normalizeHandle(a.username);
  const hb = normalizeHandle(b.username);
  if (ha && hb) {
    if (ha === hb) {
      score += 55;
      reasons.push(`Identical handle @${a.username}`);
    } else if (ha.length >= 5 && hb.length >= 5 && (ha.includes(hb) || hb.includes(ha))) {
      score += 28;
      reasons.push("Handle is contained in the other handle");
    }
  }

  const na = normalizeHandle(a.display_name ?? "");
  const nb = normalizeHandle(b.display_name ?? "");
  if (na && nb && na.length >= 4) {
    if (na === nb) {
      score += 28;
      reasons.push(`Same display name "${a.display_name}"`);
    } else if (na.includes(nb) || nb.includes(na)) {
      score += 14;
      reasons.push("Display names overlap");
    }
  }

  const shared = [...hosts(a.bio_links)].filter((host) => hosts(b.bio_links).has(host));
  if (shared.length) {
    score += 30;
    reasons.push(`Shared bio link: ${shared.slice(0, 2).join(", ")}`);
  }

  const confidence = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  return { score: Math.min(score, 100), confidence, reasons };
}

export async function buildMatchesForSearch(supabase: DB, userId: string, searchId: string) {
  const { data: profiles, error } = await supabase
    .from("platform_profiles")
    .select("id, platform, username, display_name, bio_links")
    .eq("search_id", searchId);
  if (error) throw new Error(error.message);

  const list = (profiles ?? []) as Candidate[];
  const rows: {
    user_id: string;
    platform_profile_id_a: string;
    platform_profile_id_b: string;
    confidence: string;
    score: number;
    reasons: string[];
  }[] = [];

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.platform === b.platform) continue;
      const { score, confidence, reasons } = scorePair(a, b);
      if (score < 28) continue;
      rows.push({
        user_id: userId,
        platform_profile_id_a: a.id,
        platform_profile_id_b: b.id,
        confidence,
        score,
        reasons,
      });
    }
  }

  if (!rows.length) return { created: 0 };

  const ids = list.map((p) => p.id);
  const { data: existing } = await supabase
    .from("profile_matches")
    .select("platform_profile_id_a, platform_profile_id_b")
    .in("platform_profile_id_a", ids);
  const seen = new Set(
    (existing ?? []).map((row: any) => `${row.platform_profile_id_a}|${row.platform_profile_id_b}`),
  );
  const fresh = rows.filter((row) => !seen.has(`${row.platform_profile_id_a}|${row.platform_profile_id_b}`));
  if (!fresh.length) return { created: 0 };

  const { error: insertError } = await supabase.from("profile_matches").insert(fresh);
  if (insertError) throw new Error(insertError.message);
  return { created: fresh.length };
}
