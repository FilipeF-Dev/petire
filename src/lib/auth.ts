import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ManagerSession = {
  userId: string;
  email: string;
  role: "manager" | "admin";
  /** null quando role === "admin" — o admin não é dono de nenhuma loja. */
  storeId: string | null;
  /** Slug da loja. Serve para revalidar /loja/[slug] depois de editar o cardápio. */
  storeSlug: string | null;
};

/**
 * Autorização de verdade da área logada.
 *
 * O proxy já barrou quem não tem sessão, mas ele é um filtro de borda e pode
 * ser contornado. Toda página sob /gerente e /admin precisa chamar isto.
 */
export async function requireManager(): Promise<ManagerSession> {
  const supabase = await createClient();

  /*
    `getClaims()`, e não `getUser()`.

    Os dois provam a mesma coisa — que este JWT foi emitido pelo nosso projeto
    e não expirou —, mas por caminhos de custo muito diferente: `getUser()`
    pergunta ao servidor de Auth a cada página, e `getClaims()` confere a
    assinatura aqui mesmo, com a chave pública do projeto (ES256), guardada
    depois da primeira vez. Medido no log do próprio GoTrue, a pergunta ao
    servidor custava 79ms de média — em toda troca de aba, antes de qualquer
    dado aparecer.

    Verificar a assinatura localmente é o que o Supabase recomenda desde que
    as chaves assimétricas existem, e não afrouxa nada: quem não tem a chave
    privada não forja um token que passe aqui. E o RLS continua sendo a
    fronteira que decide o que este usuário lê e escreve — isto aqui só diz
    quem ele é.
  */
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  if (!userId) {
    redirect("/entrar");
  }

  // RLS em managers já limita a linha do próprio usuário.
  const { data: manager } = await supabase
    .from("managers")
    .select("store_id, role, email, stores(slug)")
    .eq("id", userId)
    .maybeSingle();

  if (!manager) {
    // Usuário autenticado no Supabase mas sem cadastro de gerente. Acontece se
    // alguém criar uma conta fora do fluxo de onboarding do admin.
    redirect("/sem-acesso");
  }

  return {
    userId,
    email: manager.email,
    role: manager.role,
    storeId: manager.store_id,
    storeSlug: manager.stores?.slug ?? null,
  };
}

/** Como requireManager, mas exige o papel de admin do Petire. */
export async function requireAdmin(): Promise<ManagerSession> {
  const session = await requireManager();

  if (session.role !== "admin") {
    redirect("/gerente");
  }

  return session;
}
