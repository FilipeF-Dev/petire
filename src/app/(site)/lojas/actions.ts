"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  formValues,
  suggestionSchema,
  toFormState,
  type FormState,
} from "@/lib/validation";

/**
 * A indicação de loja feita por quem não encontrou nada.
 *
 * `demand_signals` já diz que alguém procurou e não achou. Não diz qual porta
 * bater — e quem sabe isso é justamente a pessoa que acabou de não encontrar a
 * lanchonete favorita dela.
 *
 * Escreve com service_role pelo mesmo motivo de /api/demand: a tabela não
 * aceita insert do browser. Se aceitasse, a fila de prospecção do Petire seria
 * uma caixa de spam aberta.
 *
 * O que se guarda é o contato **da loja**, público por natureza. Nada
 * identifica quem indicou.
 */
export async function suggestStore(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = suggestionSchema.safeParse({
    storeName: formData.get("storeName") ?? "",
    contact: formData.get("contact") ?? "",
    citySlug: formData.get("citySlug") ?? "",
    neighborhoodSlug: formData.get("neighborhoodSlug") ?? "",
  });

  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const admin = createAdminClient();
  const { error } = await admin.from("store_suggestions").insert({
    store_name: parsed.data.storeName,
    contact: parsed.data.contact || null,
    city_slug: parsed.data.citySlug,
    neighborhood_slug: parsed.data.neighborhoodSlug,
  });

  if (error) {
    return {
      error: "Não consegui registrar a indicação. Tente de novo?",
      values: formValues(formData),
    };
  }

  return { error: null, savedAt: Date.now() };
}
