import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { PromotionForm } from "../promotion-form";

export const metadata: Metadata = {
  title: "Nova promoção",
  robots: { index: false, follow: false },
};

export default async function NovaPromocaoPage() {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("store_id", session.storeId)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <PageHeader
        title="Nova promoção"
        description="O desconto vira selo no cardápio e já sai abatido na mensagem do pedido."
      />
      <PromotionForm products={products ?? []} />
    </div>
  );
}
