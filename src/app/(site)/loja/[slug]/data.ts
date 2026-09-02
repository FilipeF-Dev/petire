import { cache } from "react";

import {
  DETAIL_SELECT,
  viewRow,
  type PublicStoreDetail,
} from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * `cache()` para a página e o generateMetadata compartilharem a mesma consulta
 * dentro do mesmo render — sem isso o banco é lido duas vezes por página.
 */
export const getStorePage = cache(async (slug: string) => {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("stores_public")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  const store = viewRow<PublicStoreDetail>(data);
  if (!store) return null;

  const [categoriesResult, productsResult, hoursResult, promotionsResult] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name")
        .eq("store_id", store.id)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("products")
        .select(
          "id, name, description, price_cents, image_url, is_available, category_id, option_groups(id, name, min_select, max_select, sort_order, options(id, name, price_delta_cents, is_available, sort_order))",
        )
        .eq("store_id", store.id)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("store_hours")
        .select("weekday, opens_at, closes_at")
        .eq("store_id", store.id)
        .order("weekday")
        .order("opens_at"),
      supabase
        .from("promotions")
        .select("product_id, kind, value, starts_at, ends_at")
        .eq("store_id", store.id)
        .eq("is_active", true),
    ]);

  return {
    store,
    categories: categoriesResult.data ?? [],
    products: productsResult.data ?? [],
    hours: hoursResult.data ?? [],
    promotions: promotionsResult.data ?? [],
  };
});

export type StorePage = NonNullable<Awaited<ReturnType<typeof getStorePage>>>;
