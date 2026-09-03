"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { dayEndsAt, dayStartsAt } from "@/lib/promotions";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  promotionSchema,
  toFormState,
  uuid,
  type FormState,
} from "@/lib/validation";

/**
 * Promoção mexe no preço que o cliente vê, então a página pública precisa ser
 * invalidada na mesma hora — anunciar um desconto que o cardápio ainda não
 * mostra é o mesmo defeito de um item esgotado que continua à venda.
 *
 * O que a revalidação não alcança é a promoção **agendada**: ela entra sozinha
 * quando a hora chega, e até lá nada dispara um novo render. Por isso a tela
 * avisa que uma promoção marcada para depois pode levar até uma hora para
 * aparecer — que é o `revalidate` de /loja/[slug].
 */
function refreshPromotions(storeSlug: string | null) {
  revalidatePath("/gerente/promocoes");
  if (storeSlug) revalidatePath(`/loja/${storeSlug}`);
}

function promotionErrorMessage(code: string | undefined) {
  // 23503 = o produto escolhido não é desta loja
  if (code === "23503") return "Esse item não pertence à sua loja.";
  // 23514 = check do banco (percentual fora de 1–100, janela invertida)
  if (code === "23514") return "Confira o desconto e as datas.";
  return "Não foi possível salvar a promoção.";
}

export async function savePromotion(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const parsed = promotionSchema.safeParse({
    productId: formData.get("productId") ?? "",
    kind: formData.get("kind") ?? "percent",
    value: formData.get("value") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const promotionId = formData.get("promotionId");

  const values = {
    product_id: parsed.data.productId,
    kind: parsed.data.kind,
    value: parsed.data.value,
    // Sem data de início, vale a partir de agora.
    starts_at: parsed.data.startsOn
      ? dayStartsAt(parsed.data.startsOn)
      : new Date().toISOString(),
    ends_at: parsed.data.endsOn ? dayEndsAt(parsed.data.endsOn) : null,
  };

  if (typeof promotionId === "string" && promotionId !== "") {
    const { error } = await supabase
      .from("promotions")
      .update(values)
      .eq("id", promotionId)
      .eq("store_id", session.storeId);

    if (error) {
      return {
        error: promotionErrorMessage(error.code),
        values: formValues(formData),
      };
    }
  } else {
    const { error } = await supabase
      .from("promotions")
      .insert({ ...values, store_id: session.storeId });

    if (error) {
      return {
        error: promotionErrorMessage(error.code),
        values: formValues(formData),
      };
    }
  }

  refreshPromotions(session.storeSlug);
  redirect("/gerente/promocoes");
}

/**
 * Pausar em vez de apagar.
 *
 * A promoção de fim de semana volta no fim de semana seguinte, e refazer a
 * mesma janela toda sexta é o tipo de trabalho que o lojista abandona.
 */
export async function setPromotionActive(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("promotionId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("promotions")
    .update({ is_active: formData.get("isActive") === "true" })
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshPromotions(session.storeSlug);
}

export async function deletePromotion(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("promotionId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("promotions")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshPromotions(session.storeSlug);
  redirect("/gerente/promocoes");
}
