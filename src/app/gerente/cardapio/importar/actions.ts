"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { parseMenu } from "@/lib/menu-import";
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
 * Só adiciona. Importar não apaga nada do que já existe — quem colou o
 * cardápio duas vezes conserta apagando os repetidos, e isso é bem melhor do
 * que descobrir que a importação levou junto o cardápio inteiro da loja.
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

  const menu = parseMenu(text);
  if (menu.total === 0) {
    return {
      error: "Não encontrei nenhum item com preço.",
      values: formValues(formData),
    };
  }

  const supabase = await createClient();
  const storeId = session.storeId;

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("store_id", storeId),
    supabase
      .from("products")
      .select("category_id, sort_order")
      .eq("store_id", storeId),
  ]);

  const existing = categoriesResult.data ?? [];
  const products = productsResult.data ?? [];

  // A categoria é única por (store_id, name), e "LANCHES" e "Lanches" são a
  // mesma seção para quem lê o cardápio. Casar sem diferenciar maiúscula evita
  // tanto o erro 23505 quanto a seção duplicada.
  const byName = new Map(
    existing.map((category) => [category.name.toLowerCase(), category.id]),
  );

  let nextCategoryOrder = existing.length;

  for (const section of menu.sections) {
    if (!section.category) continue;
    if (byName.has(section.category.toLowerCase())) continue;

    const { data, error } = await supabase
      .from("menu_categories")
      .insert({
        store_id: storeId,
        name: section.category,
        sort_order: nextCategoryOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        error: `Não foi possível criar a categoria "${section.category}".`,
        values: formValues(formData),
      };
    }

    byName.set(section.category.toLowerCase(), data.id);
    nextCategoryOrder += 1;
  }

  // Cada categoria continua de onde parou, para o item novo entrar depois do
  // que já estava lá em vez de brigar por posição com ele.
  const nextOrder = new Map<string | null, number>();
  for (const product of products) {
    const key = product.category_id;
    nextOrder.set(key, Math.max(nextOrder.get(key) ?? 0, product.sort_order + 1));
  }

  const rows = menu.sections.flatMap((section) => {
    const categoryId = section.category
      ? (byName.get(section.category.toLowerCase()) ?? null)
      : null;

    return section.items.map((item) => {
      const order = nextOrder.get(categoryId) ?? 0;
      nextOrder.set(categoryId, order + 1);

      return {
        store_id: storeId,
        category_id: categoryId,
        name: item.name,
        price_cents: item.priceCents,
        sort_order: order,
      };
    });
  });

  const { error } = await supabase.from("products").insert(rows);
  if (error) {
    return {
      error: "Não foi possível gravar os itens.",
      values: formValues(formData),
    };
  }

  revalidatePath("/gerente/cardapio");
  if (session.storeSlug) revalidatePath(`/loja/${session.storeSlug}`);

  redirect("/gerente/cardapio");
}
