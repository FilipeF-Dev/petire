import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = {
  title: "Editar categoria",
  robots: { index: false, follow: false },
};

export default async function EditarCategoriaPage({
  params,
}: PageProps<"/gerente/cardapio/categoria/[id]">) {
  const { id } = await params;
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("id", id)
    .eq("store_id", session.storeId)
    .maybeSingle();

  if (!category) notFound();

  return (
    <div>
      <PageHeader title="Editar categoria" />
      <CategoryForm category={category} />
    </div>
  );
}
