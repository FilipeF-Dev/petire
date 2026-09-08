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

  const [productsResult, storeResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name")
      .eq("store_id", session.storeId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("stores")
      .select("plan")
      .eq("id", session.storeId)
      .maybeSingle(),
  ]);

  return (
    <div>
      <PageHeader
        title="Nova promoção"
        description="Vira selo no cardápio e já sai abatido no pedido."
      />
      <PromotionForm
        products={productsResult.data ?? []}
        canSchedule={storeResult.data?.plan === "plus"}
      />
    </div>
  );
}
