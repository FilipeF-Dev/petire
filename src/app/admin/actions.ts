"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  newStoreSchema,
  slugify,
  subscriptionSchema,
  formValues,
  toFormState,
  uuid,
  type FormState,
} from "@/lib/validation";

/**
 * Operações que o RLS não permite de propósito: criar loja, criar o login do
 * lojista e mexer na assinatura. Tudo passa por `service_role`, sempre depois
 * de `requireAdmin()`.
 */

/**
 * Tirar uma loja do ar precisa invalidar a página dela.
 *
 * Sem isto, a versão estática continua servindo até o backstop de uma hora — e
 * uma loja suspensa por falta de pagamento seguiria recebendo pedidos.
 */
function refreshStorefront(slug: string | null) {
  revalidatePath("/");
  revalidatePath("/lojas");
  revalidatePath("/admin");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/loja/${slug}`);
}

/** Senha inicial legível, para o admin passar por telefone sem soletrar hex. */
function initialPassword(): string {
  const words = ["pao", "mesa", "gelo", "forno", "balcao", "copo", "brasa"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `petire-${word}-${digits}`;
}

export type NewStoreState = FormState & {
  created?: { email: string; password: string; slug: string };
};

export async function createStore(
  _previous: NewStoreState,
  formData: FormData,
): Promise<NewStoreState> {
  await requireAdmin();

  const parsed = newStoreSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    cep: formData.get("cep") ?? "",
    stateUf: formData.get("stateUf") ?? "",
    ibgeCode: formData.get("ibgeCode") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    whatsapp: formData.get("whatsapp") ?? "",
    kind: formData.get("kind"),
    managerEmail: formData.get("managerEmail"),
    trialDays: formData.get("trialDays") ?? "90",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const data = parsed.data;
  const slug = data.slug ?? slugify(data.name);
  if (!slug) {
    return {
      error: null,
      fieldErrors: { slug: "Não consegui gerar um apelido a partir do nome." },
      values: formValues(formData),
    };
  }

  const admin = createAdminClient();

  const until = new Date();
  until.setDate(until.getDate() + data.trialDays);

  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({
      slug,
      name: data.name,
      cep: data.cep,
      state_uf: data.stateUf,
      ibge_code: data.ibgeCode,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      whatsapp_e164: data.whatsapp,
      kind: data.kind,
      // Entra no ar só depois que o lojista montar o cardápio. Loja vazia no
      // catálogo é pior do que loja nenhuma.
      is_active: false,
      subscription_status: "trial",
      subscription_until: until.toISOString().slice(0, 10),
    })
    .select("id, slug")
    .single();

  if (storeError || !store) {
    return {
      error:
        storeError?.code === "23505"
          ? "Já existe uma loja com esse apelido."
          : "Não foi possível criar a loja.",
      values: formValues(formData),
    };
  }

  const password = initialPassword();
  const { data: created, error: userError } =
    await admin.auth.admin.createUser({
      email: data.managerEmail,
      password,
      email_confirm: true,
    });

  if (userError || !created.user) {
    // Sem o login, a loja é inútil e ficaria órfã na listagem.
    await admin.from("stores").delete().eq("id", store.id);
    return {
      error: userError?.message.includes("already")
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar o login do lojista.",
      values: formValues(formData),
    };
  }

  const { error: managerError } = await admin.from("managers").insert({
    id: created.user.id,
    store_id: store.id,
    role: "manager",
    email: data.managerEmail,
  });

  if (managerError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("stores").delete().eq("id", store.id);
    return { error: "Não foi possível vincular o lojista à loja." };
  }

  refreshStorefront(store.slug);

  // A senha aparece uma vez só: ela não fica gravada em lugar nenhum legível.
  return {
    error: null,
    savedAt: Date.now(),
    created: { email: data.managerEmail, password, slug: store.slug },
  };
}

export async function setStoreActive(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = uuid.safeParse(formData.get("storeId"));
  if (!id.success) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("stores")
    .update({ is_active: formData.get("isActive") === "true" })
    .eq("id", id.data)
    .select("slug")
    .single();

  refreshStorefront(data?.slug ?? null);
}

export async function setSubscription(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = subscriptionSchema.safeParse({
    storeId: formData.get("storeId"),
    status: formData.get("status"),
    until: formData.get("until") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .update({
      subscription_status: parsed.data.status,
      subscription_until: parsed.data.until,
    })
    .eq("id", parsed.data.storeId)
    .select("slug")
    .single();

  if (error) return { error: "Não foi possível salvar a assinatura." };

  refreshStorefront(data?.slug ?? null);
  return { error: null, savedAt: Date.now() };
}

/**
 * Nova senha para quem perdeu a antiga. Não existe fluxo de "esqueci minha
 * senha" no MVP — o lojista liga e o admin resolve.
 */
export async function resetManagerPassword(
  _previous: NewStoreState,
  formData: FormData,
): Promise<NewStoreState> {
  await requireAdmin();

  const id = uuid.safeParse(formData.get("managerId"));
  if (!id.success) return { error: "Gerente inválido." };

  const admin = createAdminClient();
  const password = initialPassword();

  const { data, error } = await admin.auth.admin.updateUserById(id.data, {
    password,
  });

  if (error || !data.user?.email) {
    return { error: "Não foi possível trocar a senha." };
  }

  return {
    error: null,
    savedAt: Date.now(),
    created: { email: data.user.email, password, slug: "" },
  };
}
