"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formValues, toFormState, type FormState } from "@/lib/validation";

/**
 * O levantamento de rua.
 *
 * Escrita e leitura passam por `service_role` porque `prospects` tem RLS ligada
 * e nenhuma policy — a lista de quem o Petire está prestes a abordar, com o
 * estado de cada conversa, não é coisa que o browser de ninguém deva ler.
 */

const prospectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da loja.")
    .max(80, "Nome muito longo."),
  city: z.string().trim().min(2, "Informe a cidade.").max(80),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(80),
});

const STATUSES = ["a_visitar", "visitada", "cadastrada", "recusou"] as const;
type Status = (typeof STATUSES)[number];

export async function addProspect(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = prospectSchema.safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
    neighborhood: formData.get("neighborhood") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const admin = createAdminClient();
  const { error } = await admin.from("prospects").insert({
    name: parsed.data.name,
    city: parsed.data.city,
    neighborhood: parsed.data.neighborhood,
    // Ausente é "não", e não "não sei": quem preenche está parado na frente da
    // loja. Ver o comentário da migration.
    has_menu: formData.get("has_menu") === "on",
    has_whatsapp: formData.get("has_whatsapp") === "on",
    on_app: formData.get("on_app") === "on",
  });

  if (error) return { error: "Não foi possível anotar a loja." };

  revalidatePath("/admin/prospeccao");
  return { error: null, savedAt: Date.now() };
}

export async function setProspectStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number.parseInt(String(formData.get("prospectId") ?? ""), 10);
  if (!Number.isInteger(id)) return;

  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as Status)) return;

  const admin = createAdminClient();
  await admin
    .from("prospects")
    .update({ status: status as Status })
    .eq("id", id);

  revalidatePath("/admin/prospeccao");
}

export async function deleteProspect(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number.parseInt(String(formData.get("prospectId") ?? ""), 10);
  if (!Number.isInteger(id)) return;

  const admin = createAdminClient();
  await admin.from("prospects").delete().eq("id", id);

  revalidatePath("/admin/prospeccao");
}
