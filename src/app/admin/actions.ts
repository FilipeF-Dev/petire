"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  editStoreSchema,
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

export async function updateStore(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const storeId = uuid.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: "Loja inválida." };

  const parsed = editStoreSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    cep: formData.get("cep") ?? "",
    stateUf: formData.get("stateUf") ?? "",
    ibgeCode: formData.get("ibgeCode") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    whatsapp: formData.get("whatsapp") ?? "",
    kind: formData.get("kind"),
    cuisineTags: formData.get("cuisineTags") ?? "",
    deliveryFee: formData.get("deliveryFee") ?? "0",
    deliveryMinutes: formData.get("deliveryMinutes") ?? "",
    minOrder: formData.get("minOrder") ?? "0",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const data = parsed.data;
  const newSlug = data.slug!;
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("stores")
    .select("slug")
    .eq("id", storeId.data)
    .maybeSingle();

  if (!current) return { error: "Loja não encontrada." };

  const { error } = await admin
    .from("stores")
    .update({
      slug: newSlug,
      name: data.name,
      description: data.description,
      cep: data.cep,
      state_uf: data.stateUf,
      ibge_code: data.ibgeCode,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      whatsapp_e164: data.whatsapp,
      kind: data.kind,
      cuisine_tags: data.cuisineTags,
      delivery_fee_cents: data.deliveryFee,
      delivery_minutes: data.deliveryMinutes,
      min_order_cents: data.minOrder,
    })
    .eq("id", storeId.data);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Já existe outra loja com esse apelido."
          : "Não foi possível salvar a loja.",
      values: formValues(formData),
    };
  }

  if (current.slug !== newSlug) {
    // O apelido novo pode ter pertencido a alguém antes; ele agora é de uma
    // loja viva, então sai do histórico para não virar um redirecionamento
    // circular.
    await admin.from("store_slug_history").delete().eq("slug", newSlug);

    // O antigo passa a redirecionar. É o que segura os links que o cliente
    // salvou e o que o Google já indexou.
    await admin
      .from("store_slug_history")
      .upsert(
        { slug: current.slug, store_id: storeId.data },
        { onConflict: "slug" },
      );

    revalidatePath(`/loja/${current.slug}`);
  }

  refreshStorefront(newSlug);
  return { error: null, savedAt: Date.now() };
}

/**
 * Lista tudo que está sob um prefixo no bucket.
 *
 * O `list` do Storage não é recursivo, e as fotos ficam em
 * `<store_id>/produtos/...`. Sem descer um nível, os arquivos ficariam órfãos
 * ocupando espaço pago, sem nada apontando para eles.
 */
async function listStorageFiles(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string,
): Promise<string[]> {
  const { data } = await admin.storage
    .from("store-images")
    .list(prefix, { limit: 1000 });

  const paths: string[] = [];
  for (const entry of data ?? []) {
    const full = `${prefix}/${entry.name}`;
    // Pasta vem sem id.
    if (entry.id === null) paths.push(...(await listStorageFiles(admin, full)));
    else paths.push(full);
  }
  return paths;
}

/**
 * Apaga a loja inteira.
 *
 * O cascade do banco leva cardápio, opções, promoções, horários, métricas e a
 * linha de gerente. Mas duas coisas ficam fora do alcance dele e precisam ser
 * apagadas à mão, senão a exclusão é só parcial:
 *
 *   - o usuário em `auth.users`, que continuaria conseguindo entrar;
 *   - as fotos no Storage, que continuariam ocupando espaço pago.
 */
export async function deleteStore(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const storeId = uuid.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: "Loja inválida." };

  const admin = createAdminClient();

  const { data: store } = await admin
    .from("stores")
    .select("slug, name")
    .eq("id", storeId.data)
    .maybeSingle();

  if (!store) return { error: "Loja não encontrada." };

  // Confirmação conferida no servidor também: o botão desabilitado na tela é
  // conveniência, não barreira.
  const confirmation = String(formData.get("confirm") ?? "").trim();
  if (confirmation !== store.slug) {
    return {
      error: null,
      fieldErrors: {
        confirm: `Digite exatamente "${store.slug}" para confirmar.`,
      },
    };
  }

  // Os gerentes precisam ser lidos antes: o cascade apaga a linha em
  // `managers` e depois não haveria como achar o usuário de auth.
  const { data: managers } = await admin
    .from("managers")
    .select("id")
    .eq("store_id", storeId.data)
    .eq("role", "manager");

  const files = await listStorageFiles(admin, storeId.data);
  if (files.length > 0) {
    await admin.storage.from("store-images").remove(files);
  }

  const { error } = await admin
    .from("stores")
    .delete()
    .eq("id", storeId.data);

  if (error) return { error: "Não foi possível apagar a loja." };

  for (const manager of managers ?? []) {
    await admin.auth.admin.deleteUser(manager.id);
  }

  refreshStorefront(store.slug);
  redirect("/admin");
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
 * Troca o e-mail de acesso do lojista.
 *
 * A loja costuma nascer com um endereço provisório, porque o cadastro acontece
 * antes de o dono passar o e-mail dele. Sem isto, a única saída seria apagar a
 * loja e refazer tudo.
 *
 * Precisa mudar em dois lugares: em `auth.users`, que é o que valida o login,
 * e em `public.managers`, que é o que o painel mostra. Deixar os dois fora de
 * sincronia é pior do que não trocar — a tela diria um e-mail e o login exigiria
 * outro.
 */
export async function updateManagerEmail(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const managerId = uuid.safeParse(formData.get("managerId"));
  if (!managerId.success) return { error: "Gerente inválido." };

  const parsed = z
    .email("E-mail inválido.")
    .safeParse(String(formData.get("email") ?? "").trim());

  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: { email: "E-mail inválido." },
      values: formValues(formData),
    };
  }

  const admin = createAdminClient();

  const { error: authError } = await admin.auth.admin.updateUserById(
    managerId.data,
    // Sem `email_confirm`, o usuário fica pendente de confirmação e não
    // consegue entrar — e não existe fluxo de e-mail no MVP para resolver.
    { email: parsed.data, email_confirm: true },
  );

  if (authError) {
    return {
      error: authError.message.includes("already")
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível trocar o e-mail de acesso.",
      values: formValues(formData),
    };
  }

  const { error } = await admin
    .from("managers")
    .update({ email: parsed.data })
    .eq("id", managerId.data);

  if (error) return { error: "E-mail trocado no login, mas não no painel." };

  revalidatePath("/admin");
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
