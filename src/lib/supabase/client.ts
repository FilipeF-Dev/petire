"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente Supabase para Client Components.
 * Enxerga o banco como `anon` (visitante) ou `authenticated` (gerente logado),
 * sempre sob RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
