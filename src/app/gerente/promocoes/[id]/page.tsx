import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { PromotionForm, type EditablePromotion } from "../promotion-form";

export const metadata: Metadata = {
  title: "Editar promoção",
  robots: { index: false, follow: false },
};

export default async function EditarPromocaoPage({
  params,
}: PageProps<"/gerente/promocoes/[id]">) {
  const { id } = await params;
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();

  const [promotionResult, productsResult, storeResult] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, product_id, kind, value, starts_at, ends_at, weekdays")
      .eq("id", id)
      .eq("store_id", session.storeId)
      .maybeSingle(),
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

  const promotion = promotionResult.data as EditablePromotion | null;
  if (!promotion) notFound();

  return (
    <div>
      <PageHeader title="Editar promoção" />
      <PromotionForm
        products={productsResult.data ?? []}
        promotion={promotion}
        canSchedule={storeResult.data?.plan === "plus"}
      />
    </div>
  );
}
