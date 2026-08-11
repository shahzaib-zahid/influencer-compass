import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const platformEnum = z.enum(["instagram", "facebook", "tiktok", "x", "reddit", "youtube"]);

const searchInput = z.object({
  query: z.string().trim().min(2).max(80),
  platforms: z.array(platformEnum).min(1),
  minFollowers: z.number().int().min(0).max(100_000_000).default(0),
  region: z.string().trim().max(60).nullable().default(null),
  language: z.string().trim().max(40).nullable().default(null),
  forceRefresh: z.boolean().default(false),
});

export const startSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => searchInput.parse(data))
  .handler(async ({ data, context }) => {
    const { createSearchRecord } = await import("./scope.server");
    return createSearchRecord(context.supabase, context.userId, data);
  });

export const runPlatformJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ searchId: z.string().uuid(), platform: platformEnum }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { executePlatformJob } = await import("./scope.server");
    return executePlatformJob(context.supabase, context.userId, data.searchId, data.platform);
  });

const searchIdInput = (data: unknown) => z.object({ searchId: z.string().uuid() }).parse(data);

export const stopSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchIdInput)
  .handler(async ({ data, context }) => {
    const { stopSearchJobs } = await import("./scope.server");
    return stopSearchJobs(context.supabase, context.userId, data.searchId);
  });

export const deleteSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchIdInput)
  .handler(async ({ data, context }) => {
    const { deleteSearchRecord } = await import("./scope.server");
    return deleteSearchRecord(context.supabase, context.userId, data.searchId);
  });

export const buildMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchIdInput)
  .handler(async ({ data, context }) => {
    const { buildMatchesForSearch } = await import("./match.server");
    return buildMatchesForSearch(context.supabase, context.userId, data.searchId);
  });

export const decideMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ matchId: z.string().uuid(), confirmed: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profile_matches")
      .update({ confirmed_by_user: data.confirmed })
      .eq("id", data.matchId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });