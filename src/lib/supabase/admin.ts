import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serviceRoleKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente com a chave `service_role`. **IGNORA RLS.**
 *
 * Use só onde o RLS é intencionalmente insuficiente:
 *   - painel /admin: criar loja, criar gerente, mexer na assinatura
 *   - /api/events: gravar métricas sem dar permissão de escrita ao browser
 *
 * Nunca importe este módulo de um Client Component.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() foi chamado no browser. A chave service_role nunca pode sair do servidor.",
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
