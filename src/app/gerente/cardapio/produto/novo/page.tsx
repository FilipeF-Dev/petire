import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "Novo item",
  robots: { index: false, follow: false },
};

export default async function NovoProdutoPage() {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("store_id", session.storeId)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <PageHeader
        title="Novo item"
        description="Tamanho e adicionais entram depois de criar o item."
      />
      <ProductForm storeId={session.storeId} categories={categories ?? []} />
    </div>
  );
}
