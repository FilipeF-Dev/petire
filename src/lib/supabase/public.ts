import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente da vitrine: sempre `anon`, sem ler cookies.
 *
 * O catálogo é igual para todo mundo — o cliente do Petire não faz login. E
 * `cookies()` marcaria a página como dinâmica, ou quebraria de vez em
 * `generateStaticParams` e no sitemap, que rodam no build sem request nenhum.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
