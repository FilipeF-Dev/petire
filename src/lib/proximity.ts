/**
 * Quão perto uma loja está do cliente — sem geocodificação.
 *
 * O Petire não tem coordenada de ninguém: o ViaCEP devolve endereço, não
 * latitude, e as cidades pequenas que são o mercado do Petire são justamente
 * as que os geocodificadores conhecem pior. O que existe dos dois lados é o
 * CEP, e no Brasil ele é hierárquico: os cinco primeiros dígitos vão de região
 * a divisor de subsetor, do mais amplo ao mais restrito, e os três últimos são
 * só o sufixo de distribuição. Dois CEPs que compartilham mais dígitos iniciais
 * estão em áreas mais aninhadas — logo, mais perto.
 *
 * É uma estimativa, não uma distância. Ela ordena a lista; quem confirma a
 * entrega é a loja, no WhatsApp.
 */

/** Loja sem CEP cadastrado: não dá para dizer que está longe, nem que está perto. */
const UNKNOWN = 7;

/** Dígitos do prefixo geográfico (os 5 primeiros) em comum entre dois CEPs. */
function sharedPrefix(a: string, b: string): number {
  let shared = 0;
  while (shared < 5 && a[shared] === b[shared]) shared += 1;
  return shared;
}

export type NearbyStore = {
  cep: string | null;
  neighborhood_slug: string | null;
};

export type CustomerPlace = {
  /** Só dígitos. */
  cep: string;
  /** Slug do bairro do cliente, quando o CEP dele trouxe bairro. */
  neighborhoodSlug: string | null;
};

/**
 * Menor é mais perto. 0 é o mesmo bairro; 7, uma loja sem CEP.
 *
 * O bairro ganha do CEP porque é a única afirmação direta de lugar que existe
 * nos dois cadastros — o resto é inferência sobre a numeração dos Correios.
 */
export function distanceRank(
  store: NearbyStore,
  customer: CustomerPlace,
): number {
  if (
    customer.neighborhoodSlug &&
    store.neighborhood_slug === customer.neighborhoodSlug
  ) {
    return 0;
  }

  const cep = (store.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8 || customer.cep.length !== 8) return UNKNOWN;

  return 1 + (5 - sharedPrefix(cep, customer.cep));
}

/**
 * Ordena da mais perto para a mais longe, preservando a ordem que veio do
 * banco entre lojas igualmente distantes — é o `sort` estável que mantém as
 * abertas na frente das fechadas dentro de cada faixa.
 */
export function sortByProximity<T extends NearbyStore>(
  stores: T[],
  customer: CustomerPlace | null,
): T[] {
  if (!customer) return stores;

  return [...stores].sort(
    (a, b) => distanceRank(a, customer) - distanceRank(b, customer),
  );
}
