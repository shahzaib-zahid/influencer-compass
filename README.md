# Influencer Compass

Project Overview

Build a web application called InfluencerScope — a cross-platform influencer discovery and intelligence tool that lets a user search, filter, and analyze influencers worldwide across Instagram, Facebook, TikTok, X (Twitter), Reddit, and YouTube, using Apify as the scraping/data layer. The tool should feel like a professional-grade research terminal (think Modash/HypeAuditor-style UX), not a toy demo.

Core value proposition: a recruiter or brand can type a niche (e.g., "trading," "fitness," "cooking") and instantly get a ranked, filterable, cross-platform list of the top influencers in that space, with verified metrics and their best-performing content — plus a special view showing which influencers are present across multiple platforms simultaneously, since multi-platform creators are the highest-value recruiting targets.

Tech Stack

Frontend: React + Tailwind (Lovable default), clean data-dense dashboard UI

Backend: Supabase (Postgres) for storing scraped data, caching results, and tracking search history

Data layer: Apify actors (one integration per platform — see below), triggered via Apify API from Supabase Edge Functions

Auth: Supabase Auth (email/password + Google login), since this tool will hold API keys and paid usage

Job queue: Because scraping is slow and rate-limited, use a background job pattern — user submits a search, sees a "Scraping in progress" state, and results populate as each platform's Apify run completes (use Supabase real-time subscriptions to push updates to the UI without polling)

Core Feature 1: Niche Search Across All Platforms

A single search bar where the user types a niche/keyword (e.g., "trading," "forex," "day trading") plus optional filters:

Minimum followers/subscribers

Platform(s) to include (checkboxes: Instagram, Facebook, TikTok, X, Reddit, YouTube — default all selected)

Region/language (best-effort, since not all platforms expose this reliably)

Sort by: Followers, Engagement Rate, Posting Frequency, Relevance

On submit, trigger the relevant Apify actors for each selected platform, passing the niche as a search/hashtag/keyword query

Display a loading state per platform ("Searching Instagram... Searching TikTok...") since results will arrive at different speeds

Cache results in Supabase for 24–48 hours so repeated searches on the same niche don't re-trigger expensive scrapes; show a "Last updated X hours ago — Refresh" option instead of auto-rescraping every time

Core Feature 2: Per-Platform Results Table

For each platform, show a sortable/filterable table with:

FieldNotesUsername/handleLinked to their live profileDisplay nameFollower / Subscriber countLabel this correctly per platform (Followers for IG/FB/TikTok/X, Subscribers for YouTube, Karma/Members for Reddit)Total posts / videos / shorts / reelsPlatform-appropriate: post count (IG/FB/X), video count (YouTube), video count (TikTok), post/comment karma (Reddit)Engagement rateCalculated field: (avg likes + comments) / followers × 100 — compute this yourself from the scraped post data, don't rely on Apify to hand it to you pre-computedBio/description snippetVerified badgeIf the platform exposes thisProfile linkDirect clickable URL

Each row should be expandable to show a "Top Posts" sub-panel:

Their top 3–5 posts/videos/shorts/reels by engagement (likes + comments + shares, whichever the platform exposes)

Thumbnail/preview image, caption snippet, like count, comment count, view count (if video), post date, direct link to the post

Core Feature 3: Cross-Platform Presence Matching

This is the most valuable and hardest feature — build it carefully:

After each platform search completes, run a matching pass that tries to identify the same person/brand across platforms. Match using, in priority order:

Exact or near-exact username match (allowing common variations: underscores, dots, "official," "real," numeric suffixes)

Display name similarity (fuzzy string match, e.g. Levenshtein distance)

Bio link matching — many creators put a Linktree, personal website, or one platform's handle in another platform's bio; parse bios for URLs and cross-reference

Show a dedicated "Multi-Platform Creators" section/tab that lists only influencers found on 2 or more platforms, with a row showing their combined presence: a single card per person with tabs/icons for each platform they're active on, aggregate reach (sum of followers across all matched platforms), and a confidence score for the match (High/Medium/Low) since automated identity matching is inherently probabilistic — never present a cross-platform match as 100% certain; always show the confidence level and let the user manually confirm/reject a match

Let the user manually confirm or dismiss a suggested match (thumbs up/down), and store confirmed matches in Supabase so the system "learns" and doesn't ask again for that pair

Core Feature 4: Influencer Detail Page

Clicking any influencer opens a full profile view:

All platform accounts they're confirmed on, side by side

Full metrics history if you've searched them before (store snapshots over time so you can show follower growth trends as a simple line chart)

Full top-posts gallery, not just top 3–5

A "Add to Recruitment Tracker" button — this should export the influencer's key fields (name, platform(s), profile links, follower counts) as a CSV row, formatted to match a standard recruitment-tracker structure (username, platform, profile link, followers, niche, notes) so it can be pasted directly into a spreadsheet

Core Feature 5: Saved Searches & Alerts

Let users save a niche search (e.g., "Trading — Global") and re-run it with one click

Optional: notify the user (in-app, or email via Supabase + Resend) when a saved search's results change significantly (e.g., a new influencer enters the top 20, or someone's follower count jumps a set %) — this turns the tool from a one-time lookup into an ongoing monitoring system

Apify Integration Notes

Set this up as a Supabase Edge Function per platform that calls the relevant Apify actor via the Apify API (https://api.apify.com/v2/acts/{actor_id}/runs), polls for run completion, then pulls the dataset via /v2/datasets/{id}/items and normalizes it into a shared schema before writing to Supabase.

Important realities to design around rather than ignore:

Not all platforms are equally scrapable. Instagram, Facebook, and TikTok actively fight scraping and have volatile, ToS-restricted access — Apify actors for these exist but break/change often and can get accounts or proxies blocked. Build the system so a failed or partial scrape on one platform degrades gracefully (show "Instagram data temporarily unavailable" rather than crashing the whole search).

X (Twitter) locked down its API significantly; most reliable Apify actors for X now rely on scraping the web interface, which is fragile and rate-limited — budget for this being the least reliable data source.

Reddit doesn't have "influencers" in the traditional follower sense — design this platform's results around top posters/moderators in niche-relevant subreddits (e.g., r/Daytrading, r/Forex) ranked by karma and post engagement, not "followers."

YouTube is the most stable and reliable to scrape/query (Apify actors and even the official YouTube Data API work well here) — treat it as your most trustworthy data source and weight confidence scores accordingly in the cross-platform matching.

Store the Apify actor ID, run ID, and timestamp with every batch of scraped data, so you can debug bad data back to its source run.

Respect each platform's rate limits deliberately — add a queuing/throttling layer in the Edge Functions rather than firing all actor runs simultaneously, or you risk your Apify account or proxies getting flagged.

Let the admin (you) configure which Apify actor ID is used per platform in a settings table, not hardcoded — actor availability and quality on Apify's marketplace changes over time, so you'll likely swap actors as better ones appear.

Data & Legal Considerations to Design Around

Add a simple settings page where the user can input and manage their own Apify API token (don't hardcode it) — this keeps usage costs tied to the account owner and makes the tool reusable/sellable later.

Show scrape cost estimates before running an expensive multi-platform search (Apify bills per compute unit/result) — a simple "This search will use approximately X Apify credits" estimate prevents surprise bills.

Add a data freshness indicator on every result ("Scraped 3 hours ago") since follower counts and post data go stale quickly.

Since this tool aggregates public profile data at scale, add a short in-app notice reminding users that scraped data should be used in line with each platform's terms of service and applicable data-privacy law in their jurisdiction — this is a genuine operational/legal risk area for tools like this, not just boilerplate.

UI/UX Direction

Dashboard-style layout: left sidebar for search/filters, main panel for results, right-side detail drawer for the expanded influencer view

Data-dense but clean — this is a professional research tool, not a consumer app. Favor tables and sortable columns over cards for the main results view; use cards only in the "Multi-Platform Creators" section where visual platform-icon grouping matters

Platform icons (Instagram, Facebook, TikTok, X, Reddit, YouTube) as consistent visual tags throughout so users can scan quickly

Dark mode by default, given the target user will likely have this open for long research sessions

Empty/loading/error states designed explicitly for each platform panel, since partial scrape failures are expected, not exceptional

Suggested Database Schema (Supabase)

searches (id, user_id, niche_query, filters_json, created_at)

influencers (id, canonical_name, created_at, updated_at)

platform_profiles (id, influencer_id [nullable until matched], platform, username, display_name, profile_url, follower_count, post_count, bio, verified, last_scraped_at, apify_run_id)

posts (id, platform_profile_id, post_url, caption, like_count, comment_count, view_count, posted_at, thumbnail_url)

profile_matches (id, platform_profile_id_a, platform_profile_id_b, confidence, confirmed_by_user boolean, created_at)

saved_searches (id, user_id, niche_query, filters_json, alert_enabled boolean)

metric_snapshots (id, platform_profile_id, follower_count, snapshot_date) — for growth-trend charts

Build Priority Order (for Lovable's iterative build process)

Auth + basic dashboard shell

Apify API key settings + one working platform integration end-to-end (recommend starting with YouTube, since it's the most stable) to prove the pipeline

Add remaining platforms one at a time, each with graceful failure handling

Results table + top-posts expansion

Cross-platform matching logic + manual confirm/reject UI

Detail page + CSV export

Saved searches + alerts (final polish phase)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9b6ef042-517d-4705-9da7-b03700120a75).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
