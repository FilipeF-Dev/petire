"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

/**
 * `next` vem da query string, então é entrada do usuário. Só aceitamos caminhos
 * internos da área logada — sem isso, `/entrar?next=https://outro.site` viraria
 * um open redirect com a marca do Petire.
 */
function safeNext(value: string | null): string {
  if (!value) return "/gerente";
  if (value.startsWith("/gerente") || value.startsWith("/admin")) return value;
  return "/gerente";
}

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next") as string | null);

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagem genérica de propósito: distinguir "e-mail não existe" de "senha
    // errada" entrega a lista de gerentes cadastrados.
    return { error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/entrar");
}
