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

/**
 * Os cabeçalhos de segurança.
 *
 * Sobre o CSP, sem vender o que ele não entrega: o Next injeta scripts em
 * linha no HTML de toda página, e proibi-los exigiria nonce por requisição —
 * ou seja, middleware em tudo e adeus página estática, que é justamente o que
 * faz a vitrine ser rápida. Então `'unsafe-inline'` fica, e **este CSP não
 * impede XSS em linha**. O que ele impede é o resto do estrago, que costuma
 * ser o estrago de verdade:
 *
 * - `script-src 'self'`: o script injetado não consegue buscar a carga de
 *   fora. A maior parte dos ataques reais é uma linha que chama um arquivo.
 * - `connect-src`: não dá para mandar o carrinho e o endereço do cliente
 *   para um servidor qualquer.
 * - `form-action 'self'`: não dá para apontar um formulário nosso para fora.
 * - `frame-ancestors 'none'`: ninguém põe o Petire dentro de um iframe para
 *   colher clique.
 * - `base-uri 'self'`: não dá para reescrever a base e sequestrar os links
 *   relativos da página.
 *
 * viacep.com.br está no `connect-src` porque a busca de CEP acontece no
 * navegador, no cadastro e no endereço de entrega.
 */
const supabase = "https://*.supabase.co";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}${isDev ? " http://127.0.0.1:* http://localhost:*" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} https://viacep.com.br${isDev ? " ws://localhost:* http://127.0.0.1:* http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nenhuma tela pede câmera, microfone ou localização. Negar tudo agora custa
  // nada e evita que um script injetado peça em nome do site.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
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

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
