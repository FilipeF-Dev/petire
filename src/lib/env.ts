/**
 * Leitura das variáveis de ambiente.
 *
 * As NEXT_PUBLIC_* precisam ser lidas por acesso literal a `process.env.NOME` —
 * é assim que o Next as substitui no bundle. Um acesso dinâmico devolveria
 * undefined no browser.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

export const supabaseUrl = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);

export const supabaseAnonKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * WhatsApp do Petire, onde o lojista pede ajuda.
 *
 * Quem trava no cadastro precisa hoje achar a conversa antiga do onboarding — e
 * quem não acha simplesmente para de usar o painel, sem nunca reclamar. Churn
 * silencioso é o mais caro, porque não aparece.
 *
 * Só dígitos, como `stores.whatsapp_e164`. Vazio esconde o rodapé de suporte:
 * em desenvolvimento não há para quem escrever, e um link quebrado é pior do
 * que nenhum link.
 */
export const supportWhatsapp = (
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ""
).replace(/\D/g, "");

/** Só no servidor. Ver src/lib/supabase/admin.ts. */
export function serviceRoleKey(): string {
  return required(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
}
