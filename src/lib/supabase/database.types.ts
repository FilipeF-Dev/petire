export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      demand_signals: {
        Row: {
          city_slug: string | null
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["demand_kind"]
          neighborhood_slug: string | null
          term: string | null
        }
        Insert: {
          city_slug?: string | null
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["demand_kind"]
          neighborhood_slug?: string | null
          term?: string | null
        }
        Update: {
          city_slug?: string | null
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["demand_kind"]
          neighborhood_slug?: string | null
          term?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["event_kind"]
          product_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["event_kind"]
          product_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["event_kind"]
          product_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["manager_role"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["manager_role"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["manager_role"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "managers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          created_at: string
          id: string
          max_select: number
          min_select: number
          name: string
          product_id: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name: string
          product_id: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name?: string
          product_id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_product_same_store"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price_delta_cents: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_delta_cents?: number
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_delta_cents?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_group_same_store"
            columns: ["group_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      order_confirmations: {
        Row: {
          confirmed: number
          created_at: string
          id: number
          opened: number
          store_id: string
          week_start: string
        }
        Insert: {
          confirmed: number
          created_at?: string
          id?: never
          opened?: number
          store_id: string
          week_start: string
        }
        Update: {
          confirmed?: number
          created_at?: string
          id?: never
          opened?: number
          store_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_confirmations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_confirmations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          name_slug: string | null
          price_cents: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          name_slug?: string | null
          price_cents: number
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          name_slug?: string | null
          price_cents?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_same_store"
            columns: ["category_id", "store_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["promotion_kind"]
          product_id: string | null
          starts_at: string
          store_id: string
          updated_at: string
          value: number
          weekdays: number[] | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["promotion_kind"]
          product_id?: string | null
          starts_at?: string
          store_id: string
          updated_at?: string
          value: number
          weekdays?: number[] | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promotion_kind"]
          product_id?: string | null
          starts_at?: string
          store_id?: string
          updated_at?: string
          value?: number
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_same_store"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          city: string
          city_slug: string | null
          created_at: string
          has_menu: boolean
          has_whatsapp: boolean
          id: number
          name: string
          neighborhood: string
          neighborhood_slug: string | null
          note: string | null
          on_app: boolean
          status: Database["public"]["Enums"]["prospect_status"]
          updated_at: string
        }
        Insert: {
          city: string
          city_slug?: string | null
          created_at?: string
          has_menu?: boolean
          has_whatsapp?: boolean
          id?: never
          name: string
          neighborhood: string
          neighborhood_slug?: string | null
          note?: string | null
          on_app?: boolean
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
        }
        Update: {
          city?: string
          city_slug?: string | null
          created_at?: string
          has_menu?: boolean
          has_whatsapp?: boolean
          id?: never
          name?: string
          neighborhood?: string
          neighborhood_slug?: string | null
          note?: string | null
          on_app?: boolean
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
        }
        Relationships: []
      }
      store_applications: {
        Row: {
          address: string | null
          cep: string | null
          city: string
          created_at: string
          ibge_code: string | null
          id: number
          kind: Database["public"]["Enums"]["store_kind"]
          manager_email: string
          neighborhood: string
          note: string | null
          reviewed_at: string | null
          state_uf: string | null
          status: Database["public"]["Enums"]["application_status"]
          store_id: string | null
          store_name: string
          whatsapp_e164: string
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city: string
          created_at?: string
          ibge_code?: string | null
          id?: never
          kind: Database["public"]["Enums"]["store_kind"]
          manager_email: string
          neighborhood: string
          note?: string | null
          reviewed_at?: string | null
          state_uf?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name: string
          whatsapp_e164: string
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string
          created_at?: string
          ibge_code?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["store_kind"]
          manager_email?: string
          neighborhood?: string
          note?: string | null
          reviewed_at?: string | null
          state_uf?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name?: string
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_applications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_applications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          opens_at: string
          store_id: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          opens_at: string
          store_id: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          opens_at?: string
          store_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_month_metrics: {
        Row: {
          cart_adds: number
          created_at: string
          month: string
          store_id: string
          store_views: number
          whatsapp_clicks: number
        }
        Insert: {
          cart_adds?: number
          created_at?: string
          month: string
          store_id: string
          store_views?: number
          whatsapp_clicks?: number
        }
        Update: {
          cart_adds?: number
          created_at?: string
          month?: string
          store_id?: string
          store_views?: number
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_month_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_month_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_month_top_products: {
        Row: {
          adds: number
          month: string
          name: string
          product_id: string | null
          store_id: string
        }
        Insert: {
          adds: number
          month: string
          name: string
          product_id?: string | null
          store_id: string
        }
        Update: {
          adds?: number
          month?: string
          name?: string
          product_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_month_top_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_month_top_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_month_top_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_slug_history: {
        Row: {
          created_at: string
          slug: string
          store_id: string
        }
        Insert: {
          created_at?: string
          slug: string
          store_id: string
        }
        Update: {
          created_at?: string
          slug?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_slug_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_slug_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_suggestions: {
        Row: {
          city_slug: string | null
          contact: string | null
          created_at: string
          id: number
          neighborhood_slug: string | null
          store_name: string
        }
        Insert: {
          city_slug?: string | null
          contact?: string | null
          created_at?: string
          id?: never
          neighborhood_slug?: string | null
          store_name: string
        }
        Update: {
          city_slug?: string | null
          contact?: string | null
          created_at?: string
          id?: never
          neighborhood_slug?: string | null
          store_name?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          cep: string | null
          city: string
          city_slug: string | null
          cover_url: string | null
          created_at: string
          cuisine_tags: string[]
          delivery_fee_cents: number
          delivery_minutes: number | null
          description: string | null
          free_delivery: boolean
          ibge_code: string | null
          id: string
          is_active: boolean
          is_founder: boolean
          is_open_manual: boolean | null
          kind: Database["public"]["Enums"]["store_kind"]
          lat: number | null
          lng: number | null
          logo_url: string | null
          min_order_cents: number
          name: string
          name_slug: string | null
          neighborhood: string
          neighborhood_slug: string | null
          plan: Database["public"]["Enums"]["store_plan"]
          published_at: string | null
          slug: string
          state_uf: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          subscription_until: string | null
          updated_at: string
          whatsapp_e164: string
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city: string
          city_slug?: string | null
          cover_url?: string | null
          created_at?: string
          cuisine_tags?: string[]
          delivery_fee_cents?: number
          delivery_minutes?: number | null
          description?: string | null
          free_delivery?: boolean
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          is_founder?: boolean
          is_open_manual?: boolean | null
          kind?: Database["public"]["Enums"]["store_kind"]
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order_cents?: number
          name: string
          name_slug?: string | null
          neighborhood: string
          neighborhood_slug?: string | null
          plan?: Database["public"]["Enums"]["store_plan"]
          published_at?: string | null
          slug: string
          state_uf?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          subscription_until?: string | null
          updated_at?: string
          whatsapp_e164: string
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string
          city_slug?: string | null
          cover_url?: string | null
          created_at?: string
          cuisine_tags?: string[]
          delivery_fee_cents?: number
          delivery_minutes?: number | null
          description?: string | null
          free_delivery?: boolean
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          is_founder?: boolean
          is_open_manual?: boolean | null
          kind?: Database["public"]["Enums"]["store_kind"]
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order_cents?: number
          name?: string
          name_slug?: string | null
          neighborhood?: string
          neighborhood_slug?: string | null
          plan?: Database["public"]["Enums"]["store_plan"]
          published_at?: string | null
          slug?: string
          state_uf?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          subscription_until?: string | null
          updated_at?: string
          whatsapp_e164?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          covers_until: string
          created_at: string
          id: number
          note: string | null
          paid_on: string
          store_id: string
        }
        Insert: {
          amount_cents: number
          covers_until: string
          created_at?: string
          id?: never
          note?: string | null
          paid_on?: string
          store_id: string
        }
        Update: {
          amount_cents?: number
          covers_until?: string
          created_at?: string
          id?: never
          note?: string | null
          paid_on?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      neighborhoods_public: {
        Row: {
          city: string | null
          city_slug: string | null
          neighborhood: string | null
          neighborhood_slug: string | null
          state_uf: string | null
          store_count: number | null
        }
        Relationships: []
      }
      stores_public: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          city_slug: string | null
          cover_url: string | null
          cuisine_tags: string[] | null
          delivery_fee_cents: number | null
          delivery_minutes: number | null
          description: string | null
          free_delivery: boolean | null
          id: string | null
          is_open_manual: boolean | null
          is_open_now: boolean | null
          kind: Database["public"]["Enums"]["store_kind"] | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          min_order_cents: number | null
          name: string | null
          name_slug: string | null
          neighborhood: string | null
          neighborhood_slug: string | null
          slug: string | null
          state_uf: string | null
          whatsapp_e164: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          city_slug?: string | null
          cover_url?: string | null
          cuisine_tags?: string[] | null
          delivery_fee_cents?: number | null
          delivery_minutes?: number | null
          description?: string | null
          free_delivery?: boolean | null
          id?: string | null
          is_open_manual?: boolean | null
          is_open_now?: never
          kind?: Database["public"]["Enums"]["store_kind"] | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order_cents?: number | null
          name?: string | null
          name_slug?: string | null
          neighborhood?: string | null
          neighborhood_slug?: string | null
          slug?: string | null
          state_uf?: string | null
          whatsapp_e164?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          city_slug?: string | null
          cover_url?: string | null
          cuisine_tags?: string[] | null
          delivery_fee_cents?: number | null
          delivery_minutes?: number | null
          description?: string | null
          free_delivery?: boolean | null
          id?: string | null
          is_open_manual?: boolean | null
          is_open_now?: never
          kind?: Database["public"]["Enums"]["store_kind"] | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          min_order_cents?: number | null
          name?: string | null
          name_slug?: string | null
          neighborhood?: string | null
          neighborhood_slug?: string | null
          slug?: string | null
          state_uf?: string | null
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      demand_summary: {
        Args: { window_days?: number }
        Returns: {
          hits: number
          kind: Database["public"]["Enums"]["demand_kind"]
          label: string
        }[]
      }
      founder_slots: { Args: never; Returns: number }
      founder_slots_left: {
        Args: { target_city: string; target_neighborhood: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      maintain_events: { Args: { retention_days?: number }; Returns: number }
      manages_store: { Args: { target: string }; Returns: boolean }
      slugify: { Args: { input: string }; Returns: string }
      storage_store_id: { Args: { object_name: string }; Returns: string }
      store_is_open: {
        Args: { at_time?: string; target: string }
        Returns: boolean
      }
      store_is_public: { Args: { target: string }; Returns: boolean }
      store_item_limit: { Args: { target: string }; Returns: number }
      store_manager_limit: { Args: { target: string }; Returns: number }
      store_menu_summary: {
        Args: never
        Returns: {
          available: number
          items: number
          last_edit: string
          store_id: string
        }[]
      }
      store_metrics: {
        Args: { target: string; window_days?: number }
        Returns: {
          cart_adds: number
          store_views: number
          whatsapp_clicks: number
        }[]
      }
      store_metrics_between: {
        Args: { from_at: string; target: string; to_at: string }
        Returns: {
          cart_adds: number
          store_views: number
          whatsapp_clicks: number
        }[]
      }
      store_month_report: {
        Args: { month_start: string; target: string }
        Returns: {
          cart_adds: number
          store_views: number
          whatsapp_clicks: number
        }[]
      }
      store_month_top: {
        Args: { max_rows?: number; month_start: string; target: string }
        Returns: {
          adds: number
          name: string
          product_id: string
        }[]
      }
      store_pending_confirmation: {
        Args: { target: string }
        Returns: {
          opened: number
          week_end: string
          week_start: string
        }[]
      }
      store_schedules_promotions: { Args: { target: string }; Returns: boolean }
      store_top_products: {
        Args: { max_rows?: number; target: string; window_days?: number }
        Returns: {
          adds: number
          name: string
          product_id: string
        }[]
      }
      store_top_products_between: {
        Args: {
          from_at: string
          max_rows?: number
          target: string
          to_at: string
        }
        Returns: {
          adds: number
          name: string
          product_id: string
        }[]
      }
    }
    Enums: {
      application_status: "pending" | "approved" | "rejected"
      demand_kind: "search_empty" | "area_uncovered"
      event_kind: "store_view" | "cart_add" | "whatsapp_click"
      manager_role: "manager" | "admin"
      promotion_kind: "percent" | "fixed"
      prospect_status: "a_visitar" | "visitada" | "cadastrada" | "recusou"
      store_kind: "food" | "drinks" | "both"
      store_plan: "basico" | "plus"
      subscription_status: "trial" | "active" | "past_due" | "suspended"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: ["pending", "approved", "rejected"],
      demand_kind: ["search_empty", "area_uncovered"],
      event_kind: ["store_view", "cart_add", "whatsapp_click"],
      manager_role: ["manager", "admin"],
      promotion_kind: ["percent", "fixed"],
      prospect_status: ["a_visitar", "visitada", "cadastrada", "recusou"],
      store_kind: ["food", "drinks", "both"],
      store_plan: ["basico", "plus"],
      subscription_status: ["trial", "active", "past_due", "suspended"],
    },
  },
} as const

