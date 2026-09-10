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

/**
 * "coca-cola-2l" → "cocacola2l"
 *
 * Gêmea da coluna `name_compact` no banco, que é `replace(slugify(nome), '-',
 * '')`. Ver a migration 20260917120000_busca_colada.sql — as duas precisam
 * concordar pelo mesmo motivo que `slugify` precisa: quem compara é o banco
 * numa ponta e o navegador na outra, sobre os mesmos nomes.
 */
export function compact(slug: string): string {
  return slug.replace(/-/g, "");
}

/**
 * Este nome responde ao que foi digitado?
 *
 * Cada palavra precisa aparecer, e ela vale de duas formas: no slug, com os
 * separadores, e no slug colado. É o que faz "xtudo" encontrar o X-Tudo sem
 * fazer "x" e "tudo" deixarem de funcionar — e é a mesma regra que a consulta
 * do catálogo monta em SQL, do outro lado.
 *
 * A busca dentro do cardápio usa isto direto; a do catálogo não pode, porque
 * quem filtra lá é o Postgres. Manter as duas na mesma frase é o que evita a
 * loja aparecer na lista e o item sumir quando o cliente entra nela.
 */
export function matchesTerms(slug: string, terms: string[]): boolean {
  const flat = compact(slug);
  return terms.every((term) => slug.includes(term) || flat.includes(term));
}

/**
 * Quão bem este nome responde ao que foi digitado. Menor é melhor.
 *
 * Quem procura "coca" espera a Coca-Cola antes do "Bolo de fubá com coca" —
 * as duas casam, mas uma é o que a pessoa quis dizer. A régua é grosseira de
 * propósito, e é a que dá para explicar em voz alta:
 *
 *   0 — é exatamente o que se digitou
 *   1 — começa com o que se digitou
 *   2 — contém em algum lugar
 *
 * Não é busca por relevância estatística, e não deve virar uma: num cardápio
 * de bairro, com dezenas de itens, ordenar por "começa com" já põe o certo em
 * cima. O que empata é desempatado por quem chama — preço, distância, o que
 * fizer sentido na tela.
 */
export function relevance(slug: string, terms: string[]): number {
  if (terms.length === 0) return 2;

  const digitado = terms.join("-");
  const colado = compact(slug);
  const digitadoColado = terms.join("");

  if (slug === digitado || colado === digitadoColado) return 0;
  if (slug.startsWith(digitado) || colado.startsWith(digitadoColado)) return 1;
  return 2;
}
