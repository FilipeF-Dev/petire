"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  confirmationSchema,
  formValues,
  toFormState,
  type FormState,
} from "@/lib/validation";

/**
 * Quantos pedidos a loja diz ter recebido na semana.
 *
 * É a única coisa que o gerente escreve sobre as próprias métricas, e é de
 * propósito: `whatsapp_click` mede intenção, e só quem está do outro lado do
 * balcão sabe quantos viraram pedido. A razão entre os dois é o que transforma
 * "saíram 84 daqui" de alegação em conta conferida.
 *
 * O denominador não passa por aqui. `opened` é preenchido por trigger, a partir
 * dos eventos de verdade — ele informa o numerador, o sistema informa o resto.
 *
 * Escreve com o cliente autenticado, não com service_role: a policy de insert
 * já exige `manages_store`, e passar por cima dela seria trocar uma garantia do
 * banco por uma checagem que alguém pode esquecer numa tela nova.
 */
export async function confirmOrders(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sessão sem loja." };

  const parsed = confirmationSchema.safeParse({
    weekStart: formData.get("weekStart"),
    confirmed: formData.get("confirmed") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const { error } = await supabase.from("order_confirmations").insert({
    store_id: session.storeId,
    week_start: parsed.data.weekStart,
    confirmed: parsed.data.confirmed,
  });

  if (error) {
    // Índice único: a semana já foi respondida, provavelmente noutra aba.
    if (error.code === "23505") {
      revalidatePath("/gerente");
      return { error: null, savedAt: Date.now() };
    }
    return {
      error: "Não consegui guardar a resposta.",
      values: formValues(formData),
    };
  }

  revalidatePath("/gerente");
  return { error: null, savedAt: Date.now() };
}
