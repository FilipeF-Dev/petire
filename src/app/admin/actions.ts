"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { initialPassword } from "@/lib/initial-password";
import { parseMenuInput } from "@/lib/menu-import";
import { limparCardapio, salvarCardapio } from "@/lib/menu-import-save";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  editStoreSchema,
  newStoreSchema,
  paymentSchema,
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

export type NewStoreState = FormState & {
  created?: { email: string; password: string; slug: string };
};

/**
 * Criar a loja e o login do lojista, que são inseparáveis.
 *
 * Mora fora de `createStore` porque a aprovação de uma candidatura faz
 * exatamente isto — e uma segunda cópia da sequência divergiria na primeira vez
 * que alguém mexesse na ordem dos passos ou no desfazer.
 *
 * Os desfazer importam: sem o login, a loja é inútil e fica órfã na listagem;
 * sem a linha em `managers`, o usuário de auth entra e não é dono de nada.
 */
type ProvisionInput = {
  name: string;
  slug: string;
  cep: string | null;
  stateUf: string | null;
  ibgeCode: string | null;
  address: string | null;
  city: string;
  neighborhood: string;
  whatsapp: string;
  kind: "food" | "drinks" | "both";
  managerEmail: string;
  trialDays: number;
};

type ProvisionResult =
  | { ok: true; storeId: string; slug: string; email: string; password: string }
  | { ok: false; error: string };

async function provisionStore(data: ProvisionInput): Promise<ProvisionResult> {
  const admin = createAdminClient();

  const until = new Date();
  until.setDate(until.getDate() + data.trialDays);

  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({
      slug: data.slug,
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
      ok: false,
      error:
        storeError?.code === "23505"
          ? "Já existe uma loja com esse apelido."
          : "Não foi possível criar a loja.",
    };
  }

  const password = initialPassword();
  const { data: created, error: userError } = await admin.auth.admin.createUser(
    {
      email: data.managerEmail,
      password,
      email_confirm: true,
    },
  );

  if (userError || !created.user) {
    await admin.from("stores").delete().eq("id", store.id);
    return {
      ok: false,
      error: userError?.message.includes("already")
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar o login do lojista.",
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
    return { ok: false, error: "Não foi possível vincular o lojista à loja." };
  }

  // Sem revalidar nada aqui, e isso é deliberado nas duas pontas.
  //
  // Correção: a loja nasce fora do ar, então nenhuma página pública muda —
  // `stores_public` só devolve loja ativa. Não havia o que invalidar.
  //
  // E efeito colateral: `revalidatePath` limpa o cache de rota do cliente, o
  // que faz a página atual buscar de novo. Na fila de aprovação isso
  // remontaria a lista sem o pedido recém-aprovado, desmontando o card que
  // está mostrando a senha inicial — que aparece uma vez só.

  return {
    ok: true,
    storeId: store.id,
    slug: store.slug,
    email: data.managerEmail,
    password,
  };
}

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

  const result = await provisionStore({ ...data, slug });

  if (!result.ok) {
    return { error: result.error, values: formValues(formData) };
  }

  // A listagem do admin precisa mostrar a loja nova. Seguro aqui: o formulário
  // que exibe a senha está em /admin/nova-loja, não em /admin.
  revalidatePath("/admin");

  // A senha aparece uma vez só: ela não fica gravada em lugar nenhum legível.
  return {
    error: null,
    savedAt: Date.now(),
    created: {
      email: result.email,
      password: result.password,
      slug: result.slug,
    },
  };
}

/**
 * Aprovar uma candidatura: vira loja, com login, exatamente como se o admin
 * tivesse digitado.
 *
 * O apelido é gerado do nome aqui, e não pedido no formulário público: ele é a
 * URL que o Google vai indexar, e quem decide isso é quem confere se a loja
 * existe. Colisão de apelido ganha um sufixo em vez de recusar a aprovação —
 * duas lanchonetes do Zé em cidades diferentes é o caso normal, não erro.
 */
export async function approveApplication(
  _previous: NewStoreState,
  formData: FormData,
): Promise<NewStoreState> {
  await requireAdmin();

  const id = Number(formData.get("applicationId"));
  if (!Number.isInteger(id)) return { error: "Pedido inválido." };

  const admin = createAdminClient();

  const { data: application } = await admin
    .from("store_applications")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();

  if (!application) {
    return { error: "Este pedido já foi respondido." };
  }

  const base = slugify(application.store_name);
  if (!base) {
    return { error: "Não consegui gerar um apelido a partir do nome." };
  }

  const { data: taken } = await admin
    .from("stores")
    .select("slug")
    .like("slug", `${base}%`);

  const used = new Set((taken ?? []).map((store) => store.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  const result = await provisionStore({
    name: application.store_name,
    slug,
    cep: application.cep,
    stateUf: application.state_uf,
    ibgeCode: application.ibge_code,
    address: application.address,
    city: application.city,
    neighborhood: application.neighborhood,
    whatsapp: application.whatsapp_e164,
    kind: application.kind,
    managerEmail: application.manager_email,
    // As primeiras lojas de um bairro entram com 90 dias grátis: é o que paga
    // o risco de entrar num catálogo vazio. Ver docs/onboarding.md.
    trialDays: 90,
  });

  if (!result.ok) return { error: result.error };

  // Só depois de a loja existir. Marcar antes deixaria o pedido fora da fila
  // sem nada no lugar dele, se a criação falhasse.
  await admin
    .from("store_applications")
    .update({
      status: "approved",
      store_id: result.storeId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Sem revalidar esta página, de propósito. A senha inicial aparece uma vez
  // só, no card que acabou de aprovar; revalidar recarregaria a lista sem o
  // pedido aprovado, desmontando o card e levando a senha junto — antes de
  // alguém copiar. A lista se atualiza na próxima navegação.
  //
  // `provisionStore` já revalidou /admin, que é onde o número da fila aparece.
  return {
    error: null,
    savedAt: Date.now(),
    created: {
      email: result.email,
      password: result.password,
      slug: result.slug,
    },
  };
}

/**
 * Recusar. O pedido some da fila e continua na tabela — sem o registro, o
 * mesmo lojista voltaria e ninguém lembraria por que ele foi recusado.
 */
export async function rejectApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = Number(formData.get("applicationId"));
  if (!Number.isInteger(id)) return { error: "Pedido inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("store_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: "Não foi possível recusar o pedido." };

  // Como na aprovação: quem confirma que o pedido saiu da fila é o próprio
  // card. Revalidar aqui o desmontaria antes de o admin ler o que aconteceu.
  return { error: null, savedAt: Date.now() };
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

  const { error } = await admin.from("stores").delete().eq("id", storeId.data);

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
 * Troca o plano da loja.
 *
 * O plano abre recurso, nunca desconta comissão — comissão zero é a razão de a
 * loja estar aqui. Por isso nada aqui toca a vitrine: o cliente não vê plano
 * nenhum, e a ordem da lista continua sendo por distância.
 *
 * Não chama `refreshStorefront()` de propósito: `plan` não sai em
 * `stores_public`, então nenhuma página pública muda.
 */
export async function setPlan(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const storeId = uuid.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: "Loja inválida." };

  const plan = formData.get("plan");
  if (plan !== "basico" && plan !== "plus") {
    return { error: "Plano inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("stores")
    .update({ plan })
    .eq("id", storeId.data);

  if (error) return { error: "Não foi possível trocar o plano." };

  revalidatePath("/admin");
  return { error: null, savedAt: Date.now() };
}

/**
 * Marca ou desmarca a loja como fundadora.
 *
 * Quem conta a vaga é o banco: `enforce_founder_slots()` recusa a décima
 * primeira do bairro com PT422. A escassez que a venda promete precisa ser
 * verdade — "só restam duas vagas no seu bairro" dito por cima de um campo que
 * não limita nada é a primeira coisa que gasta a confiança do lojista, e ela
 * não volta.
 *
 * Não chama `refreshStorefront()`: `is_founder` não sai em `stores_public`,
 * então nenhuma página pública muda. O cliente não vê plano nem preço.
 */
export async function setFounder(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const storeId = uuid.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: "Loja inválida." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("stores")
    .update({ is_founder: formData.get("isFounder") === "true" })
    .eq("id", storeId.data);

  if (error) {
    // PT422 = o bairro esgotou as vagas. A mensagem vem do banco com o número
    // dele, e reescrevê-la aqui seria manter o mesmo texto em dois lugares.
    return {
      error:
        error.code === "PT422"
          ? error.message
          : "Não foi possível mudar a loja.",
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/loja/${storeId.data}`);
  return { error: null, savedAt: Date.now() };
}

/**
 * Registra um pagamento e move o vencimento na mesma operação.
 *
 * Antes, "recebeu o PIX" e "mudou a data" eram dois atos separados na cabeça do
 * admin, e fazer só o primeiro tira do ar uma loja que pagou. Aqui é um só: o
 * valor entra no histórico e a data que ele cobre vira o vencimento da loja.
 *
 * O status vai para `active` junto. Uma loja que acabou de pagar não é `trial`
 * nem `past_due`, e deixar isso para um segundo formulário é deixar para
 * esquecer.
 */
export async function registerPayment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = paymentSchema.safeParse({
    storeId: formData.get("storeId"),
    amount: formData.get("amount") ?? "",
    paidOn: formData.get("paidOn") ?? "",
    coversUntil: formData.get("coversUntil") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const { storeId, amount, paidOn, coversUntil, note } = parsed.data;
  const admin = createAdminClient();

  const { error: paymentError } = await admin
    .from("subscription_payments")
    .insert({
      store_id: storeId,
      amount_cents: amount,
      paid_on: paidOn,
      covers_until: coversUntil,
      note: note || null,
    });

  if (paymentError) {
    return { error: "Não foi possível registrar o pagamento." };
  }

  const { data, error } = await admin
    .from("stores")
    .update({
      subscription_status: "active",
      subscription_until: coversUntil,
    })
    .eq("id", storeId)
    .select("slug")
    .single();

  if (error) {
    // O pagamento ficou registrado; o vencimento, não. Melhor dizer isso do que
    // deixar o admin achar que a loja está em dia quando ela ainda vence hoje.
    return {
      error:
        "Pagamento registrado, mas o vencimento não foi atualizado. Ajuste a assinatura na lista.",
    };
  }

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

/**
 * O colar de cardápio do suporte, em qualquer loja.
 *
 * A mesma leitura e a mesma escrita do painel do lojista — o que muda é só de
 * quem é a loja. Existe porque a alternativa era o suporte gerar senha nova e
 * entrar como o dono, o que derruba o acesso dele para cadastrar o cardápio
 * dele. Pior ainda quando é justamente a loja nova, que ainda não tem cardápio
 * e já perde o login no primeiro contato.
 *
 * service_role como as outras escritas do admin: `manages_store()` já
 * responderia true para o papel de admin, mas o padrão aqui é escrever com a
 * chave de serviço, e um caminho diferente só para esta ação seria uma pedra
 * no meio do caminho de quem for ler depois.
 */
export async function importStoreMenu(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const storeId = uuid.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: "Loja inválida." };

  const text = formData.get("menu");
  if (typeof text !== "string" || text.trim() === "") {
    return { error: "Cole o cardápio antes de importar." };
  }

  const { menu, erro } = parseMenuInput(text);

  if (erro) return { error: erro, values: formValues(formData) };
  if (menu.total === 0) {
    return {
      error: "Não encontrei nenhum item no que foi colado.",
      values: formValues(formData),
    };
  }

  const admin = createAdminClient();

  /*
    Substituir apaga o cardápio antes de colar o novo.

    A leitura do texto vem **antes** da limpeza, de propósito: um JSON com erro
    de formato não pode deixar a loja sem cardápio nenhum. Depois de apagar, a
    única coisa que ainda pode falhar é a escrita, e aí a mensagem diz o que
    aconteceu em vez de sumir com o cardápio em silêncio.

    A confirmação por digitação é conferida aqui, e não só na tela: o botão
    desabilitado é fricção para quem está distraído, não uma tranca. Quem
    chamar esta ação direto passa pelo mesmo teste.
  */
  if (formData.get("substituir") === "on") {
    const { data: loja } = await admin
      .from("stores")
      .select("slug")
      .eq("id", storeId.data)
      .maybeSingle();

    if (!loja || formData.get("confirmar") !== loja.slug) {
      return {
        error: `Para substituir, digite ${loja?.slug ?? "o apelido da loja"} no campo de confirmação.`,
        values: formValues(formData),
      };
    }

    const limpeza = await limparCardapio(admin, storeId.data);
    if (limpeza.erro) {
      return { error: limpeza.erro, values: formValues(formData) };
    }
  }

  const resultado = await salvarCardapio(admin, storeId.data, menu);

  if (resultado.erro) {
    return { error: resultado.erro, values: formValues(formData) };
  }

  const { data: store } = await admin
    .from("stores")
    .select("slug")
    .eq("id", storeId.data)
    .maybeSingle();

  revalidatePath(`/admin/loja/${storeId.data}`);
  refreshStorefront(store?.slug ?? null);

  return { error: null, savedAt: Date.now() };
}
