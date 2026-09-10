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
    supabase
      .from("option_groups")
      .select(
        "id, name, min_select, max_select, sort_order, options(id, name, price_delta_cents, is_available, sort_order)",
      )
      .eq("product_id", id)
      .eq("store_id", session.storeId)
      .order("sort_order"),
  ]);

  const product = productResult.data;
  if (!product) notFound();

  // O PostgREST não ordena a relação aninhada junto com a principal.
  const groups = (groupsResult.data ?? []).map((group) => ({
    ...group,
    options: [...group.options].sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader title={product.name} description="Editar item do cardápio" />
        <ProductForm
          storeId={session.storeId}
          categories={categoriesResult.data ?? []}
          product={product}
        />
      </div>

      <OptionsEditor productId={product.id} groups={groups} />
    </div>
  );
}
