export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      influencers: {
        Row: {
          canonical_name: string
          created_at: string
          id: string
          niche: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          id?: string
          niche?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          id?: string
          niche?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      metric_snapshots: {
        Row: {
          created_at: string
          engagement_rate: number | null
          follower_count: number | null
          id: string
          platform_profile_id: string
          post_count: number | null
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          platform_profile_id: string
          post_count?: number | null
          snapshot_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          platform_profile_id?: string
          post_count?: number | null
          snapshot_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_platform_profile_id_fkey"
            columns: ["platform_profile_id"]
            isOneToOne: false
            referencedRelation: "platform_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_profiles: {
        Row: {
          actor_id: string | null
          apify_run_id: string | null
          avatar_url: string | null
          avg_comments: number | null
          avg_likes: number | null
          avg_views: number | null
          bio: string | null
          bio_links: string[]
          created_at: string
          display_name: string | null
          engagement_rate: number | null
          follower_count: number | null
          id: string
          influencer_id: string | null
          language: string | null
          last_scraped_at: string
          niche_query: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_count: number | null
          posting_frequency: number | null
          profile_url: string | null
          raw_json: Json | null
          region: string | null
          relevance_score: number | null
          search_id: string | null
          updated_at: string
          user_id: string
          username: string
          verified: boolean
        }
        Insert: {
          actor_id?: string | null
          apify_run_id?: string | null
          avatar_url?: string | null
          avg_comments?: number | null
          avg_likes?: number | null
          avg_views?: number | null
          bio?: string | null
          bio_links?: string[]
          created_at?: string
          display_name?: string | null
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          influencer_id?: string | null
          language?: string | null
          last_scraped_at?: string
          niche_query?: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_count?: number | null
          posting_frequency?: number | null
          profile_url?: string | null
          raw_json?: Json | null
          region?: string | null
          relevance_score?: number | null
          search_id?: string | null
          updated_at?: string
          user_id: string
          username: string
          verified?: boolean
        }
        Update: {
          actor_id?: string | null
          apify_run_id?: string | null
          avatar_url?: string | null
          avg_comments?: number | null
          avg_likes?: number | null
          avg_views?: number | null
          bio?: string | null
          bio_links?: string[]
          created_at?: string
          display_name?: string | null
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          influencer_id?: string | null
          language?: string | null
          last_scraped_at?: string
          niche_query?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          post_count?: number | null
          posting_frequency?: number | null
          profile_url?: string | null
          raw_json?: Json | null
          region?: string | null
          relevance_score?: number | null
          search_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "platform_profiles_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_profiles_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          actor_id: string
          created_at: string
          credits_per_result: number
          enabled: boolean
          max_results: number
          notes: string | null
          platform: Database["public"]["Enums"]["platform"]
          reliability: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          credits_per_result?: number
          enabled?: boolean
          max_results?: number
          notes?: string | null
          platform: Database["public"]["Enums"]["platform"]
          reliability?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          credits_per_result?: number
          enabled?: boolean
          max_results?: number
          notes?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          reliability?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          caption: string | null
          comment_count: number | null
          created_at: string
          engagement_total: number | null
          id: string
          like_count: number | null
          platform_profile_id: string
          post_url: string | null
          posted_at: string | null
          share_count: number | null
          thumbnail_url: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          caption?: string | null
          comment_count?: number | null
          created_at?: string
          engagement_total?: number | null
          id?: string
          like_count?: number | null
          platform_profile_id: string
          post_url?: string | null
          posted_at?: string | null
          share_count?: number | null
          thumbnail_url?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          caption?: string | null
          comment_count?: number | null
          created_at?: string
          engagement_total?: number | null
          id?: string
          like_count?: number | null
          platform_profile_id?: string
          post_url?: string | null
          posted_at?: string | null
          share_count?: number | null
          thumbnail_url?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_platform_profile_id_fkey"
            columns: ["platform_profile_id"]
            isOneToOne: false
            referencedRelation: "platform_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_matches: {
        Row: {
          confidence: Database["public"]["Enums"]["match_confidence"]
          confirmed_by_user: boolean | null
          created_at: string
          id: string
          platform_profile_id_a: string
          platform_profile_id_b: string
          reasons: string[]
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["match_confidence"]
          confirmed_by_user?: boolean | null
          created_at?: string
          id?: string
          platform_profile_id_a: string
          platform_profile_id_b: string
          reasons?: string[]
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["match_confidence"]
          confirmed_by_user?: boolean | null
          created_at?: string
          id?: string
          platform_profile_id_a?: string
          platform_profile_id_b?: string
          reasons?: string[]
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_matches_platform_profile_id_a_fkey"
            columns: ["platform_profile_id_a"]
            isOneToOne: false
            referencedRelation: "platform_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_matches_platform_profile_id_b_fkey"
            columns: ["platform_profile_id_b"]
            isOneToOne: false
            referencedRelation: "platform_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean
          created_at: string
          filters_json: Json
          id: string
          label: string
          last_run_at: string | null
          niche_query: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_enabled?: boolean
          created_at?: string
          filters_json?: Json
          id?: string
          label: string
          last_run_at?: string | null
          niche_query: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_enabled?: boolean
          created_at?: string
          filters_json?: Json
          id?: string
          label?: string
          last_run_at?: string | null
          niche_query?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_jobs: {
        Row: {
          actor_id: string | null
          apify_dataset_id: string | null
          apify_run_id: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          platform: Database["public"]["Enums"]["platform"]
          result_count: number
          search_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          platform: Database["public"]["Enums"]["platform"]
          result_count?: number
          search_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["platform"]
          result_count?: number
          search_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_jobs_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          created_at: string
          estimated_credits: number
          filters_json: Json
          id: string
          niche_query: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_credits?: number
          filters_json?: Json
          id?: string
          niche_query: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_credits?: number
          filters_json?: Json
          id?: string
          niche_query?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      job_status: "queued" | "running" | "succeeded" | "failed" | "partial"
      match_confidence: "high" | "medium" | "low"
      platform: "instagram" | "facebook" | "tiktok" | "x" | "reddit" | "youtube"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      job_status: ["queued", "running", "succeeded", "failed", "partial"],
      match_confidence: ["high", "medium", "low"],
      platform: ["instagram", "facebook", "tiktok", "x", "reddit", "youtube"],
    },
  },
} as const
