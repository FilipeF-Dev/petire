import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { OptionsEditor } from "../options-editor";
import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "Editar item",
  robots: { index: false, follow: false },
};

export default async function EditarProdutoPage({
  params,
}: PageProps<"/gerente/cardapio/produto/[id]">) {
  const { id } = await params;
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();

  const [productResult, categoriesResult, groupsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, price_cents, category_id, image_url, is_available",
      )
      .eq("id", id)
      .eq("store_id", session.storeId)
      .maybeSingle(),
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("store_id", session.storeId)
      .order("sort_order")
      .order("created_at"),
    /*
      Todos os grupos da loja, com as opções e com em quantos itens cada um
      está. Uma consulta só, e não duas: as duas listas da tela — os grupos
      deste item e os que existem para reaproveitar — são recortes do mesmo
      acervo, e o número de itens é o aviso que o lojista precisa ler antes de
      editar um grupo que vale para doze hambúrgueres.
    */
    supabase
      .from("option_groups")
      .select(
        "id, name, min_select, max_select, product_option_groups(product_id, sort_order), options(id, name, price_delta_cents, is_available, sort_order)",
      )
      .eq("store_id", session.storeId)
      .order("name"),
  ]);

  const product = productResult.data;
  if (!product) notFound();

  // O PostgREST não ordena a relação aninhada junto com a principal.
  const all = (groupsResult.data ?? []).map((group) => ({
    ...group,
    usedBy: group.product_option_groups.length,
    here: group.product_option_groups.find((link) => link.product_id === id),
    options: [...group.options].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const groups = all
    .filter((group) => group.here)
    .sort((a, b) => (a.here?.sort_order ?? 0) - (b.here?.sort_order ?? 0));

  // O que dá para reaproveitar aqui: o resto do acervo da loja.
  const reusable = all
    .filter((group) => !group.here)
    .map((group) => ({ id: group.id, name: group.name, usedBy: group.usedBy }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title={product.name}
          description="Editar item do cardápio"
        />
        <ProductForm
          storeId={session.storeId}
          categories={categoriesResult.data ?? []}
          product={product}
        />
      </div>

      <OptionsEditor
        productId={product.id}
        groups={groups}
        reusable={reusable}
      />
    </div>
  );
}
