"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { parseMenuInput } from "@/lib/menu-import";
import { salvarCardapio } from "@/lib/menu-import-save";
import { createClient } from "@/lib/supabase/server";
import { formValues, type FormState } from "@/lib/validation";

/**
 * Grava o cardápio colado.
 *
 * O texto é lido **de novo** aqui, com a mesma função que montou a conferência
 * na tela. O que o browser mandou é a linha crua, não a lista já interpretada:
 * uma Server Action é um endpoint como outro qualquer, e aceitar a lista
 * pronta seria aceitar preço escolhido por quem chamou.
 *
 * A escrita mora em `salvarCardapio`, compartilhada com a tela do admin — o
 * suporte do Petire cola cardápio de outras lojas por lá, e duas cópias desta
 * lógica é como as duas telas passam a criar cardápio de jeitos diferentes.
 */
export async function importMenu(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const text = formData.get("menu");
  if (typeof text !== "string" || text.trim() === "") {
    return { error: "Cole o cardápio antes de importar." };
  }

  const { menu, erro } = parseMenuInput(text);

  if (erro) return { error: erro, values: formValues(formData) };
  if (menu.total === 0) {
    return {
      error: "Não encontrei nenhum item com preço.",
      values: formValues(formData),
    };
  }

  const supabase = await createClient();
  const resultado = await salvarCardapio(supabase, session.storeId, menu);

  if (resultado.erro) {
    return { error: resultado.erro, values: formValues(formData) };
  }

  revalidatePath("/gerente/cardapio");
  if (session.storeSlug) revalidatePath(`/loja/${session.storeSlug}`);

  redirect("/gerente/cardapio");
}
