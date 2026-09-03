/**
 * Normaliza texto para agrupamento e URL.
 *
 * Precisa dar exatamente o mesmo resultado que `public.slugify()` no banco —
 * é assim que o CEP do cliente encontra as lojas da cidade dele. Ver a
 * migration `20260902150000_address_normalization.sql`.
 */
/** Preposições que ficam minúsculas no meio do nome. */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

/**
 * "juiz-de-fora" → "Juiz de Fora"
 *
 * Só para exibir quando não há loja no resultado e o nome escrito da cidade
 * não veio do banco. Sem isto o título mostra o slug cru — e é justamente o
 * que toda cidade nova mostra antes da primeira loja entrar.
 */
export function humanizePlace(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((palavra, index) =>
      index > 0 && MINUSCULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1),
    )
    .join(" ");
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
