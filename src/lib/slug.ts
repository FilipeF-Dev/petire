/**
 * Normaliza texto para agrupamento e URL.
 *
 * Precisa dar exatamente o mesmo resultado que `public.slugify()` no banco —
 * é assim que o CEP do cliente encontra as lojas da cidade dele. Ver a
 * migration `20260902150000_address_normalization.sql`.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
