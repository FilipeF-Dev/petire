import type { NextConfig } from "next";

/**
 * As fotos do cardápio ficam no Storage do Supabase, então o otimizador de
 * imagem do Next precisa liberar aquele host explicitamente.
 *
 * Os padrões são literais de propósito. Derivá-los de NEXT_PUBLIC_SUPABASE_URL
 * parece mais limpo, mas o valor não chega ao processo que atende
 * /_next/image, e o sintoma é um 400 "url parameter is not allowed" sem
 * nenhuma pista da causa.
 */
const isDev = process.env.NODE_ENV !== "production";

const localStoragePatterns = [
  {
    protocol: "http" as const,
    hostname: "127.0.0.1",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "http" as const,
    hostname: "localhost",
    pathname: "/storage/v1/object/public/**",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase local (`npm run db:start`), cuja porta pode variar.
      ...(isDev ? localStoragePatterns : []),
    ],

    // O Next recusa otimizar imagem servida por IP privado, como proteção
    // contra SSRF. Em desenvolvimento o Storage é 127.0.0.1, então a proteção
    // precisa sair — e só aí.
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
