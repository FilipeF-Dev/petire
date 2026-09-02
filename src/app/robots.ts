import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Área logada e API não têm nada a indexar.
      disallow: ["/gerente", "/admin", "/entrar", "/sem-acesso", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
