"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  storeHoursSchema,
  storeSchema,
  formValues,
  toFormState,
  uuid,
  type FormState,
} from "@/lib/validation";

function refreshStore(storeSlug: string | null) {
  revalidatePath("/gerente/loja");
  revalidatePath("/gerente");
  // Horário, taxa e status aberto/fechado aparecem na página pública.
  if (storeSlug) {
    revalidatePath(`/loja/${storeSlug}`);
    revalidatePath("/lojas");
  }
}

export async function saveStore(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const parsed = storeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    address: formData.get("address") ?? "",
    cep: formData.get("cep") ?? "",
    stateUf: formData.get("stateUf") ?? "",
    ibgeCode: formData.get("ibgeCode") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    cuisineTags: formData.get("cuisineTags") ?? "",
    kind: formData.get("kind"),
    deliveryFee: formData.get("deliveryFee") ?? "0",
    freeDelivery: formData.get("freeDelivery") === "on",
    deliveryMinutes: formData.get("deliveryMinutes") ?? "",
    minOrder: formData.get("minOrder") ?? "0",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();

  // is_active, subscription_status e subscription_until não estão aqui de
  // propósito: authenticated não tem GRANT UPDATE nessas colunas.
  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      whatsapp_e164: parsed.data.whatsapp,
      address: parsed.data.address,
      cep: parsed.data.cep,
      state_uf: parsed.data.stateUf,
      ibge_code: parsed.data.ibgeCode,
      city: parsed.data.city,
      neighborhood: parsed.data.neighborhood,
      cuisine_tags: parsed.data.cuisineTags,
      kind: parsed.data.kind,
      delivery_fee_cents: parsed.data.deliveryFee,
      free_delivery: parsed.data.freeDelivery,
      delivery_minutes: parsed.data.deliveryMinutes,
      min_order_cents: parsed.data.minOrder,
    })
    .eq("id", session.storeId);

  if (error) {
    return { error: "Não foi possível salvar. Confira o número do WhatsApp." };
  }

  refreshStore(session.storeSlug);
  return { error: null, savedAt: Date.now() };
}

/**
 * Override de aberto/fechado.
 *
 * "auto" grava null e a loja volta a seguir store_hours. É o estado que o
 * lojista precisa conseguir recuperar depois de fechar mais cedo num dia —
 * senão a loja fica presa em "fechada" e ninguém entende por quê.
 */
export async function setOpenOverride(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const mode = formData.get("mode");
  const value = mode === "open" ? true : mode === "closed" ? false : null;
  if (mode !== "open" && mode !== "closed" && mode !== "auto") return;

  const supabase = await createClient();
  await supabase
    .from("stores")
    .update({ is_open_manual: value })
    .eq("id", session.storeId);

  refreshStore(session.storeSlug);
}

export async function addStoreHours(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  // Numa constante porque o `map` abaixo é um closure, e ali dentro o
  // TypeScript já não sabe que a checagem acima aconteceu.
  const storeId = session.storeId;
  if (!storeId) return { error: "Sua conta não tem loja." };

  const parsed = storeHoursSchema.safeParse({
    weekdays: formData.getAll("weekdays"),
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  // Repetir uma faixa que o dia já tem não é erro — é o que acontece quando o
  // lojista marca a semana inteira para preencher os dias que faltavam. O
  // índice único de `store_hours` absorve os repetidos e grava só o que é novo.
  const { error } = await supabase.from("store_hours").upsert(
    parsed.data.weekdays.map((weekday) => ({
      store_id: storeId,
      weekday,
      opens_at: parsed.data.opensAt,
      closes_at: parsed.data.closesAt,
    })),
    { onConflict: "store_id,weekday,opens_at,closes_at", ignoreDuplicates: true },
  );

  if (error) return { error: "Não foi possível salvar o horário." };

  refreshStore(session.storeSlug);
  return { error: null, savedAt: Date.now() };
}

export async function deleteStoreHour(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("hourId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("store_hours")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshStore(session.storeSlug);
}
