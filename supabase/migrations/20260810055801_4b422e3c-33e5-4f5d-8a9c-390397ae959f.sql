-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.platform AS ENUM ('instagram', 'facebook', 'tiktok', 'x', 'reddit', 'youtube');
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');
CREATE TYPE public.match_confidence AS ENUM ('high', 'medium', 'low');

-- SHARED TIMESTAMP TRIGGER FN
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_all" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- PLATFORM SETTINGS (admin-configurable Apify actors)
CREATE TABLE public.platform_settings (
  platform public.platform PRIMARY KEY,
  actor_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  reliability TEXT NOT NULL DEFAULT 'medium',
  credits_per_result NUMERIC NOT NULL DEFAULT 0.05,
  max_results INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (platform, actor_id, enabled, reliability, credits_per_result, max_results, notes) VALUES
  ('youtube',   'streamers~youtube-scraper',        true,  'high',   0.04, 30, 'Most stable data source. Weighted highest in cross-platform matching.'),
  ('reddit',    'trudax~reddit-scraper-lite',       true,  'high',   0.03, 30, 'No followers: ranked by karma and post engagement in niche subreddits.'),
  ('tiktok',    'clockworks~tiktok-scraper',        true,  'medium', 0.06, 30, 'Anti-scraping measures; expect occasional partial failures.'),
  ('instagram', 'apify~instagram-scraper',          true,  'medium', 0.07, 30, 'Volatile access; degrade gracefully on failure.'),
  ('facebook',  'apify~facebook-pages-scraper',     true,  'low',    0.07, 30, 'Limited public data and volatile access.'),
  ('x',         'apidojo~tweet-scraper',            true,  'low',    0.08, 30, 'Least reliable source since the API lockdown.');

-- SEARCHES
CREATE TABLE public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche_query TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'queued',
  estimated_credits NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.searches TO authenticated;
GRANT ALL ON public.searches TO service_role;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "searches_own_all" ON public.searches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER searches_updated_at BEFORE UPDATE ON public.searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX searches_user_created_idx ON public.searches (user_id, created_at DESC);
CREATE INDEX searches_query_idx ON public.searches (lower(niche_query));

-- SEARCH JOBS (one per platform per search)
CREATE TABLE public.search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  actor_id TEXT,
  apify_run_id TEXT,
  apify_dataset_id TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (search_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_jobs TO authenticated;
GRANT ALL ON public.search_jobs TO service_role;
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_jobs_own_all" ON public.search_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER search_jobs_updated_at BEFORE UPDATE ON public.search_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX search_jobs_search_idx ON public.search_jobs (search_id);

-- INFLUENCERS (canonical identity)
CREATE TABLE public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  niche TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT ALL ON public.influencers TO service_role;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencers_own_all" ON public.influencers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER influencers_updated_at BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLATFORM PROFILES
CREATE TABLE public.platform_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE SET NULL,
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  follower_count BIGINT,
  post_count BIGINT,
  bio TEXT,
  bio_links TEXT[] NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  region TEXT,
  language TEXT,
  avg_likes NUMERIC,
  avg_comments NUMERIC,
  avg_views NUMERIC,
  engagement_rate NUMERIC,
  posting_frequency NUMERIC,
  relevance_score NUMERIC,
  niche_query TEXT,
  raw_json JSONB,
  actor_id TEXT,
  apify_run_id TEXT,
  last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_profiles TO authenticated;
GRANT ALL ON public.platform_profiles TO service_role;
ALTER TABLE public.platform_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_profiles_own_all" ON public.platform_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER platform_profiles_updated_at BEFORE UPDATE ON public.platform_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX platform_profiles_search_idx ON public.platform_profiles (search_id, platform);
CREATE INDEX platform_profiles_user_platform_username_idx ON public.platform_profiles (user_id, platform, lower(username));

-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_profile_id UUID NOT NULL REFERENCES public.platform_profiles(id) ON DELETE CASCADE,
  post_url TEXT,
  caption TEXT,
  like_count BIGINT,
  comment_count BIGINT,
  view_count BIGINT,
  share_count BIGINT,
  engagement_total BIGINT,
  posted_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_own_all" ON public.posts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX posts_profile_idx ON public.posts (platform_profile_id, engagement_total DESC);

-- PROFILE MATCHES
CREATE TABLE public.profile_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_profile_id_a UUID NOT NULL REFERENCES public.platform_profiles(id) ON DELETE CASCADE,
  platform_profile_id_b UUID NOT NULL REFERENCES public.platform_profiles(id) ON DELETE CASCADE,
  confidence public.match_confidence NOT NULL DEFAULT 'low',
  score NUMERIC NOT NULL DEFAULT 0,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  confirmed_by_user BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_profile_id_a, platform_profile_id_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_matches TO authenticated;
GRANT ALL ON public.profile_matches TO service_role;
ALTER TABLE public.profile_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_matches_own_all" ON public.profile_matches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profile_matches_updated_at BEFORE UPDATE ON public.profile_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SAVED SEARCHES
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  niche_query TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_enabled BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_searches_own_all" ON public.saved_searches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER saved_searches_updated_at BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- METRIC SNAPSHOTS
CREATE TABLE public.metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_profile_id UUID NOT NULL REFERENCES public.platform_profiles(id) ON DELETE CASCADE,
  follower_count BIGINT,
  post_count BIGINT,
  engagement_rate NUMERIC,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_profile_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_snapshots TO authenticated;
GRANT ALL ON public.metric_snapshots TO service_role;
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_snapshots_own_all" ON public.metric_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REALTIME
ALTER TABLE public.search_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.platform_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.searches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.search_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.searches;