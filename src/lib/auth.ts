import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ManagerSession = {
  userId: string;
  email: string;
  role: "manager" | "admin";
  /** null quando role === "admin" — o admin não é dono de nenhuma loja. */
  storeId: string | null;
};

/**
 * Autorização de verdade da área logada.
 *
 * O proxy já barrou quem não tem sessão, mas ele é um filtro de borda e pode
 * ser contornado. Toda página sob /gerente e /admin precisa chamar isto.
 */
export async function requireManager(): Promise<ManagerSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  // RLS em managers já limita a linha do próprio usuário.
  const { data: manager } = await supabase
    .from("managers")
    .select("store_id, role, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!manager) {
    // Usuário autenticado no Supabase mas sem cadastro de gerente. Acontece se
    // alguém criar uma conta fora do fluxo de onboarding do admin.
    redirect("/sem-acesso");
  }

  return {
    userId: user.id,
    email: manager.email,
    role: manager.role,
    storeId: manager.store_id,
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
