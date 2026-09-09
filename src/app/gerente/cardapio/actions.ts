"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  optionGroupSchema,
  optionSchema,
  productSchema,
  formValues,
  toFormState,
  uuid,
  type FormState,
} from "@/lib/validation";

import { removeStoreImage } from "@/lib/store-images";

/**
 * Toda action aqui repete dois cuidados:
 *
 *  1. `store_id` sai da sessão, nunca do formulário. Um campo escondido é
 *     entrada do usuário como qualquer outra.
 *  2. Os updates filtram por `store_id` além do `id`. O RLS já barraria, mas
 *     assim a operação vira "nenhuma linha afetada" em vez de erro de banco.
 */

/**
 * A página pública da loja é estática — sem isto, marcar um item como esgotado
 * só apareceria para o cliente no próximo rebuild, que é exatamente o defeito
 * que o Petire não pode ter.
 */
function refreshMenu(storeSlug: string | null, productId?: string) {
  revalidatePath("/gerente/cardapio");
  if (productId) {
    revalidatePath(`/gerente/cardapio/produto/${productId}`);
  }
  if (storeSlug) {
    revalidatePath(`/loja/${storeSlug}`);
  }
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------

export async function saveCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const categoryId = formData.get("categoryId");

  if (typeof categoryId === "string" && categoryId !== "") {
    const { error } = await supabase
      .from("menu_categories")
      .update({ name: parsed.data.name })
      .eq("id", categoryId)
      .eq("store_id", session.storeId);

    if (error) return { error: categoryErrorMessage(error.code) };
  } else {
    const { count } = await supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId);

    const { error } = await supabase.from("menu_categories").insert({
      store_id: session.storeId,
      name: parsed.data.name,
      sort_order: count ?? 0,
    });

    if (error) return { error: categoryErrorMessage(error.code) };
  }

  refreshMenu(session.storeSlug);
  redirect("/gerente/cardapio");
}

function categoryErrorMessage(code: string | undefined) {
  // 23505 = unique (store_id, name)
  if (code === "23505") return "Já existe uma categoria com esse nome.";
  return "Não foi possível salvar a categoria.";
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("categoryId"));
  if (!id.success) return;

  const supabase = await createClient();

  // A FK de products usa ON DELETE SET NULL: os produtos sobrevivem e caem em
  // "Sem categoria". Apagar o cardápio junto com a categoria seria uma
  // armadilha para quem só queria renomear a seção.
  await supabase
    .from("menu_categories")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshMenu(session.storeSlug);
}

// -----------------------------------------------------------------------------
// Produtos
// -----------------------------------------------------------------------------

export async function saveProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    isAvailable: formData.get("isAvailable"),
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const productId = formData.get("productId");
  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    price_cents: parsed.data.price,
    category_id: parsed.data.categoryId,
    image_url: parsed.data.imageUrl,
    is_available: parsed.data.isAvailable,
  };

  if (typeof productId === "string" && productId !== "") {
    const { data: current } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", productId)
      .eq("store_id", session.storeId)
      .maybeSingle();

    const { error } = await supabase
      .from("products")
      .update(values)
      .eq("id", productId)
      .eq("store_id", session.storeId);

    if (error) return { error: productErrorMessage(error.code, error.message) };

    // Trocou a foto: a antiga vira lixo pago no Storage.
    if (current?.image_url && current.image_url !== values.image_url) {
      await removeStoreImage(supabase, session.storeId, current.image_url);
    }

    refreshMenu(session.storeSlug, productId);
    redirect("/gerente/cardapio");
  }

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", session.storeId);

  const { data, error } = await supabase
    .from("products")
    .insert({ ...values, store_id: session.storeId, sort_order: count ?? 0 })
    .select("id")
    .single();

  if (error || !data) {
    return { error: productErrorMessage(error?.code, error?.message) };
  }

  refreshMenu(session.storeSlug);
  // Direto para a edição: é lá que ficam tamanho e adicionais, e um produto
  // recém-criado quase sempre precisa deles.
  redirect(`/gerente/cardapio/produto/${data.id}`);
}

function productErrorMessage(code: string | undefined, message?: string) {
  // 23503 = a categoria escolhida não é desta loja
  if (code === "23503") return "Essa categoria não pertence à sua loja.";

  // PT422 = passou do teto de itens do plano. A mensagem vem do banco escrita
  // para o lojista ler, e já traz o número do plano dele — reescrevê-la aqui
  // seria manter o mesmo texto em dois lugares, prontos para divergir.
  if (code === "PT422" && message) return message;

  return "Não foi possível salvar o produto.";
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("productId"));
  if (!id.success) return;

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", id.data)
    .eq("store_id", session.storeId)
    .maybeSingle();

  // option_groups e options caem junto pelo ON DELETE CASCADE.
  await supabase
    .from("products")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  if (current?.image_url) {
    await removeStoreImage(supabase, session.storeId, current.image_url);
  }

  refreshMenu(session.storeSlug);
  redirect("/gerente/cardapio");
}

/**
 * O toggle de "esgotado". Precisa ser um toque só: é a coisa que o lojista faz
 * no meio do movimento, com o celular numa mão.
 */
export async function setProductAvailability(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("productId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_available: formData.get("isAvailable") === "true" })
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshMenu(session.storeSlug);
}

// -----------------------------------------------------------------------------
// Ordenação
// -----------------------------------------------------------------------------

type Sortable = "products" | "menu_categories";

/**
 * Troca a posição com o vizinho. Setas em vez de arrastar: arrastar em lista
 * longa no celular é frustrante, e o lojista mexe nisso raramente.
 */
export async function moveItem(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const table = formData.get("table") as Sortable;
  const direction = formData.get("direction");
  const id = uuid.safeParse(formData.get("itemId"));
  const scopeId = formData.get("scopeId");

  if (!id.success) return;
  if (table !== "products" && table !== "menu_categories") return;
  if (direction !== "up" && direction !== "down") return;

  const supabase = await createClient();
  const storeId = session.storeId;

  // Produtos são ordenados dentro da categoria; categorias, dentro da loja.
  // As duas consultas ficam separadas porque `from(union)` colapsa as colunas
  // para a interseção dos dois tipos, e `category_id` não sobrevive a isso.
  const siblings =
    table === "products"
      ? await (async () => {
          const base = supabase
            .from("products")
            .select("id")
            .eq("store_id", storeId);

          const scoped =
            typeof scopeId === "string" && scopeId !== ""
              ? base.eq("category_id", scopeId)
              : base.is("category_id", null);

          const { data } = await scoped.order("sort_order").order("created_at");
          return data;
        })()
      : await (async () => {
          const { data } = await supabase
            .from("menu_categories")
            .select("id")
            .eq("store_id", storeId)
            .order("sort_order")
            .order("created_at");
          return data;
        })();

  if (!siblings) return;

  const index = siblings.findIndex((row) => row.id === id.data);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return;

  // Reescreve a lista inteira com índices densos. Assim a ordem se conserta
  // sozinha mesmo se algum sort_order tiver ficado duplicado.
  const ids = siblings.map((row) => row.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];

  await Promise.all(
    ids.map((rowId, position) =>
      table === "products"
        ? supabase
            .from("products")
            .update({ sort_order: position })
            .eq("id", rowId)
            .eq("store_id", storeId)
        : supabase
            .from("menu_categories")
            .update({ sort_order: position })
            .eq("id", rowId)
            .eq("store_id", storeId),
    ),
  );

  refreshMenu(session.storeSlug);
}

// -----------------------------------------------------------------------------
// Grupos de opções
// -----------------------------------------------------------------------------

export async function saveOptionGroup(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const productId = uuid.safeParse(formData.get("productId"));
  if (!productId.success) return { error: "Produto inválido." };

  const parsed = optionGroupSchema.safeParse({
    name: formData.get("name"),
    selection: formData.get("selection") ?? "single",
    isRequired: formData.get("isRequired"),
    // O campo de limite só existe na tela quando a escolha é múltipla.
    maxSelect: formData.get("maxSelect") ?? "1",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const groupId = formData.get("groupId");
  const values = {
    name: parsed.data.name,
    min_select: parsed.data.minSelect,
    max_select: parsed.data.maxSelect,
  };

  if (typeof groupId === "string" && groupId !== "") {
    const { error } = await supabase
      .from("option_groups")
      .update(values)
      .eq("id", groupId)
      .eq("store_id", session.storeId);

    if (error) return { error: "Não foi possível salvar o grupo." };
  } else {
    const { count } = await supabase
      .from("option_groups")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId.data);

    const { error } = await supabase.from("option_groups").insert({
      ...values,
      store_id: session.storeId,
      product_id: productId.data,
      sort_order: count ?? 0,
    });

    if (error) return { error: "Não foi possível criar o grupo." };
  }

  refreshMenu(session.storeSlug, productId.data);
  return { error: null, savedAt: Date.now() };
}

export async function deleteOptionGroup(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("groupId"));
  const productId = formData.get("productId");
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("option_groups")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshMenu(
    session.storeSlug,
    typeof productId === "string" ? productId : undefined,
  );
}

// -----------------------------------------------------------------------------
// Opções
// -----------------------------------------------------------------------------

export async function saveOption(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sua conta não tem loja." };

  const groupId = uuid.safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Grupo inválido." };

  const parsed = optionSchema.safeParse({
    name: formData.get("name"),
    priceDelta: formData.get("priceDelta") ?? "",
  });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();
  const productId = formData.get("productId");

  const { count } = await supabase
    .from("options")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId.data);

  const { error } = await supabase.from("options").insert({
    store_id: session.storeId,
    group_id: groupId.data,
    name: parsed.data.name,
    price_delta_cents: parsed.data.priceDelta,
    sort_order: count ?? 0,
  });

  if (error) return { error: "Não foi possível adicionar a opção." };

  refreshMenu(
    session.storeSlug,
    typeof productId === "string" ? productId : undefined,
  );
  return { error: null, savedAt: Date.now() };
}

export async function deleteOption(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("optionId"));
  const productId = formData.get("productId");
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("options")
    .delete()
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshMenu(
    session.storeSlug,
    typeof productId === "string" ? productId : undefined,
  );
}

export async function setOptionAvailability(formData: FormData): Promise<void> {
  const session = await requireManager();
  if (!session.storeId) return;

  const id = uuid.safeParse(formData.get("optionId"));
  const productId = formData.get("productId");
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("options")
    .update({ is_available: formData.get("isAvailable") === "true" })
    .eq("id", id.data)
    .eq("store_id", session.storeId);

  refreshMenu(
    session.storeSlug,
    typeof productId === "string" ? productId : undefined,
  );
}
