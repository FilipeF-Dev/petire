import { siteUrl } from "./env";

/**
 * "https://petire.vercel.app" → "petire.vercel.app"
 *
 * Serve para mostrar o link da loja nos formulários do painel. Sai da mesma
 * variável que alimenta canonical e sitemap, então no dia em que o Petire
 * ganhar um domínio próprio o rótulo acompanha — em vez de virar uma mentira
 * escrita no meio do formulário.
 */
export const siteHost = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
