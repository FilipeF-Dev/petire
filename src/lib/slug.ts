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

/** Acima disso a busca vira uma frase, e nenhum card\u00e1pio responde a uma frase. */
const MAX_TERMS = 6;

/**
 * A busca digitada, quebrada em palavras.
 *
 * Comparar o slug inteiro de uma vez casa s\u00f3 o que est\u00e1 **grudado**: quem
 * digita "suco laranja" procura `suco-laranja` e n\u00e3o encontra "Suco de laranja
 * 500ml", porque tem um "de" no meio. O mesmo derruba "coca lata" contra
 * "Coca-Cola lata 350ml".
 *
 * Cada palavra vira um filtro, e todas precisam bater. Isso conserta o caso de
 * cima sem afrouxar nada: mais palavras continuam estreitando o resultado, e
 * ningu\u00e9m passa a receber loja que n\u00e3o tem nada a ver com o que procurou.
 *
 * Palavra digitada a mais que o card\u00e1pio n\u00e3o tem continua n\u00e3o achando \u2014 quem
 * escreve "coxinha de frango" onde o item \u00e9 "Coxinha frango" fica sem
 * resultado. \u00c9 o lado que sobra, e \u00e9 o mais raro dos dois.
 */
export function searchTerms(input: string): string[] {
  return slugify(input).split("-").filter(Boolean).slice(0, MAX_TERMS);
}
