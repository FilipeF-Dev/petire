import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";
import { viewRows, type PublicStoreLocation } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  // stores_public já filtra por ativa e não suspensa — loja suspensa não pode
  // continuar no sitemap depois de sair do ar.
  const { data } = await supabase
    .from("stores_public")
    .select("slug, city, neighborhood");

  const stores = viewRows<PublicStoreLocation>(data);

  const places = new Map<string, { city: string; neighborhood: string }>();
  for (const store of stores) {
    places.set(`${store.city}|${store.neighborhood}`, {
      city: store.city,
      neighborhood: store.neighborhood,
    });
  }

  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/lojas`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...[...places.values()].map((place) => ({
      url: `${siteUrl}/lojas?cidade=${encodeURIComponent(place.city)}&bairro=${encodeURIComponent(place.neighborhood)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...stores.map((store) => ({
      url: `${siteUrl}/loja/${store.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
