import type { Platform } from "./platforms";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";

export type NormalizedPost = {
  post_url: string | null;
  caption: string | null;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  share_count: number | null;
  posted_at: string | null;
  thumbnail_url: string | null;
};

export type NormalizedProfile = {
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  post_count: number | null;
  bio: string | null;
  bio_links: string[];
  verified: boolean;
  region: string | null;
  language: string | null;
  posts: NormalizedPost[];
};

type Json = Record<string, unknown>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function gatewayHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("LOVABLE_API_KEY")}`,
    "X-Connection-Api-Key": requireEnv("APIFY_API_KEY"),
    "Content-Type": "application/json",
  };
}

async function gateway(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Apify gateway ${path} failed [${response.status}]: ${body}`);
    throw new Error(`Apify request failed [${response.status}]: ${body.slice(0, 400)}`);
  }
  return response.json();
}

/** Kicks off an actor run, polls until it finishes, then returns the dataset items. */
export async function runActor(
  actorId: string,
  input: Json,
  opts: { maxWaitMs?: number; itemLimit?: number } = {},
): Promise<{ items: Json[]; runId: string; datasetId: string }> {
  const maxWaitMs = opts.maxWaitMs ?? 150_000;
  const started = await gateway(`/acts/${encodeURIComponent(actorId)}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const runData = (started as { data?: Json }).data ?? {};
  const runId = String(runData["id"] ?? "");
  const datasetId = String(runData["defaultDatasetId"] ?? "");
  if (!runId) throw new Error("Apify did not return a run id");

  const deadline = Date.now() + maxWaitMs;
  let status = String(runData["status"] ?? "READY");
  while (Date.now() < deadline && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const polled = await gateway(`/actor-runs/${runId}`);
    status = String(((polled as { data?: Json }).data ?? {})["status"] ?? status);
  }

  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    throw new Error(`Apify run ${status.toLowerCase()} (run ${runId})`);
  }

  const limit = opts.itemLimit ?? 300;
  const items = (await gateway(`/datasets/${datasetId}/items?limit=${limit}&clean=true`)) as Json[];
  if (status !== "SUCCEEDED" && (!Array.isArray(items) || items.length === 0)) {
    throw new Error(`Apify run still ${status.toLowerCase()} after waiting (run ${runId})`);
  }
  return { items: Array.isArray(items) ? items : [], runId, datasetId };
}

export function buildActorInput(
  platform: Platform,
  query: string,
  maxResults: number,
): Json {
  const items = Math.max(20, Math.min(maxResults * 6, 300));
  switch (platform) {
    case "youtube":
      return { searchKeywords: query, maxResults: items, maxResultsShorts: 0, maxResultStreams: 0 };
    case "reddit":
      return { searches: [query], maxItems: items, type: "posts", sort: "top", time: "month" };
    case "tiktok":
      return { searchQueries: [query], resultsPerPage: items, searchSection: "/video" };
    case "instagram":
      return {
        search: query,
        searchType: "hashtag",
        searchLimit: 3,
        resultsType: "posts",
        resultsLimit: items,
      };
    case "x":
      return { searchTerms: [query], maxItems: items, sort: "Top" };
    case "facebook":
      return { searchQueries: [query], resultsLimit: items, maxPages: Math.ceil(items / 10) };
  }
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pick(source: Json, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s,)"']+|(?:^|\s)(?:linktr\.ee|beacons\.ai)\/[^\s,)"']+/gi);
  return Array.from(new Set((matches ?? []).map((m) => m.trim()))).slice(0, 6);
}

type Bucket = NormalizedProfile & { _postKeys: Set<string> };

function bucketFor(map: Map<string, Bucket>, username: string): Bucket {
  const key = username.toLowerCase();
  const existing = map.get(key);
  if (existing) return existing;
  const created: Bucket = {
    username,
    display_name: null,
    profile_url: null,
    avatar_url: null,
    follower_count: null,
    post_count: null,
    bio: null,
    bio_links: [],
    verified: false,
    region: null,
    language: null,
    posts: [],
    _postKeys: new Set(),
  };
  map.set(key, created);
  return created;
}

function addPost(bucket: Bucket, post: NormalizedPost) {
  const key = post.post_url ?? `${post.caption ?? ""}|${post.like_count ?? 0}`;
  if (bucket._postKeys.has(key)) return;
  bucket._postKeys.add(key);
  bucket.posts.push(post);
}

/**
 * Normalizes raw Apify dataset items (which are usually posts/videos, not
 * profiles) into one profile per creator with their posts attached.
 */
export function normalizeItems(platform: Platform, items: Json[]): NormalizedProfile[] {
  const map = new Map<string, Bucket>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const author = ((pick(item, ["authorMeta", "author", "channel", "owner", "user"]) ??
      {}) as Json);

    let username: string | null = null;
    switch (platform) {
      case "youtube":
        username =
          str(pick(item, ["channelName", "channelUsername", "channelTitle"])) ??
          str(pick(author, ["name", "title"]));
        break;
      case "reddit":
        username = str(pick(item, ["username", "author", "userName"]));
        break;
      case "tiktok":
        username = str(pick(author, ["name", "uniqueId", "nickName"])) ?? str(pick(item, ["authorName"]));
        break;
      case "instagram":
        username = str(pick(item, ["ownerUsername", "username"])) ?? str(pick(author, ["username"]));
        break;
      case "x":
        username = str(pick(author, ["userName", "screen_name", "username"])) ?? str(pick(item, ["userName"]));
        break;
      case "facebook":
        username =
          str(pick(item, ["pageName", "user_name", "title", "name"])) ?? str(pick(author, ["name"]));
        break;
    }
    if (!username) continue;

    const bucket = bucketFor(map, username);

    const followers =
      num(pick(item, ["numberOfSubscribers", "channelTotalSubscribers", "subscriberCount", "followers", "followersCount", "likes", "fans"])) ??
      num(pick(author, ["fans", "followers", "followersCount", "subscriberCount", "numberOfSubscribers"]));
    if (followers !== null && (bucket.follower_count ?? 0) < followers) bucket.follower_count = followers;

    const karma = num(pick(item, ["userKarma", "karma", "authorKarma"]));
    if (platform === "reddit" && karma !== null && (bucket.follower_count ?? 0) < karma) {
      bucket.follower_count = karma;
    }

    const postCount =
      num(pick(item, ["channelTotalVideos", "videoCount", "postsCount", "statusesCount"])) ??
      num(pick(author, ["video", "videoCount", "postsCount", "statusesCount"]));
    if (postCount !== null && (bucket.post_count ?? 0) < postCount) bucket.post_count = postCount;

    bucket.display_name =
      bucket.display_name ??
      str(pick(item, ["channelName", "fullName", "displayName", "pageName", "title"])) ??
      str(pick(author, ["nickName", "name", "fullName", "displayName"])) ??
      username;

    bucket.profile_url =
      bucket.profile_url ??
      str(pick(item, ["channelUrl", "authorUrl", "profileUrl", "pageUrl"])) ??
      str(pick(author, ["profileUrl", "url"])) ??
      defaultProfileUrl(platform, username);

    bucket.avatar_url =
      bucket.avatar_url ??
      str(pick(item, ["channelAvatarUrl", "profilePicUrl", "avatar"])) ??
      str(pick(author, ["avatar", "profilePicUrl", "profile_image_url_https"]));

    const bio =
      str(pick(item, ["channelDescription", "biography", "description", "bio"])) ??
      str(pick(author, ["signature", "description", "biography"]));
    if (bio && (!bucket.bio || bio.length > bucket.bio.length)) bucket.bio = bio;

    if (pick(item, ["isChannelVerified", "verified", "isVerified"]) === true || author["verified"] === true) {
      bucket.verified = true;
    }

    bucket.region =
      bucket.region ?? str(pick(item, ["location", "country", "channelLocation"])) ?? str(pick(author, ["region"]));
    bucket.language = bucket.language ?? str(pick(item, ["language", "lang"]));

    addPost(bucket, {
      post_url: str(pick(item, ["url", "postUrl", "webVideoUrl", "twitterUrl", "link"])),
      caption: str(pick(item, ["title", "text", "caption", "body", "description"]))?.slice(0, 600) ?? null,
      like_count: num(pick(item, ["likes", "likesCount", "diggCount", "upVotes", "likeCount", "favoriteCount"])),
      comment_count: num(pick(item, ["commentsCount", "comments", "numberOfComments", "replyCount", "commentCount"])),
      view_count: num(pick(item, ["viewCount", "playCount", "views", "viewsCount"])),
      share_count: num(pick(item, ["shareCount", "shares", "retweetCount"])),
      posted_at: str(pick(item, ["date", "createdAt", "publishedAt", "createTimeISO", "timestamp"])),
      thumbnail_url: str(pick(item, ["thumbnailUrl", "thumbnail", "displayUrl", "covers", "videoThumbnail", "coverUrl"])),
    });
  }

  return Array.from(map.values()).map(({ _postKeys, ...profile }) => {
    void _postKeys;
    return {
      ...profile,
      bio_links: extractLinks(profile.bio),
      posts: profile.posts
        .sort((a, b) => engagementOf(b) - engagementOf(a))
        .slice(0, 12),
    };
  });
}

export function engagementOf(post: NormalizedPost): number {
  return (post.like_count ?? 0) + (post.comment_count ?? 0) + (post.share_count ?? 0);
}

function defaultProfileUrl(platform: Platform, username: string): string | null {
  const handle = username.replace(/^@/, "");
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(handle)}`;
    case "reddit":
      return `https://www.reddit.com/user/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "x":
      return `https://x.com/${handle}`;
    case "facebook":
      return `https://www.facebook.com/search/top?q=${encodeURIComponent(handle)}`;
  }
}

/** Engagement rate = (avg likes + avg comments) / followers x 100, computed by us. */
export function computeMetrics(profile: NormalizedProfile, query: string) {
  const posts = profile.posts;
  const count = posts.length || 1;
  const avgLikes = posts.reduce((sum, p) => sum + (p.like_count ?? 0), 0) / count;
  const avgComments = posts.reduce((sum, p) => sum + (p.comment_count ?? 0), 0) / count;
  const avgViews = posts.reduce((sum, p) => sum + (p.view_count ?? 0), 0) / count;
  const followers = profile.follower_count ?? 0;
  const engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : null;

  const dates = posts
    .map((p) => (p.posted_at ? new Date(p.posted_at).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  let postingFrequency: number | null = null;
  if (dates.length >= 2) {
    const spanWeeks = (dates[dates.length - 1]! - dates[0]!) / (1000 * 60 * 60 * 24 * 7);
    postingFrequency = spanWeeks > 0 ? Number((dates.length / spanWeeks).toFixed(2)) : null;
  }

  const haystack = `${profile.username} ${profile.display_name ?? ""} ${profile.bio ?? ""} ${posts
    .map((p) => p.caption ?? "")
    .join(" ")}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.filter((term) => haystack.includes(term)).length;
  const relevance = terms.length ? Number(((hits / terms.length) * 100).toFixed(1)) : 0;

  return {
    avg_likes: Number(avgLikes.toFixed(1)),
    avg_comments: Number(avgComments.toFixed(1)),
    avg_views: Number(avgViews.toFixed(1)),
    engagement_rate: engagementRate === null ? null : Number(engagementRate.toFixed(3)),
    posting_frequency: postingFrequency,
    relevance_score: relevance,
  };
}