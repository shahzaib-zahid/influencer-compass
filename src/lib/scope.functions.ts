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