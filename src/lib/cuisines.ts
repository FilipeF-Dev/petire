/**
 * O catálogo de tipos de culinária.
 *
 * A ordem não é alfabética: é a de quanto cada tipo aparece num bairro
 * brasileiro. O filtro é uma fila horizontal no celular, e o que está no fim
 * dela quase não é visto — deixar "Lanches" e "Pizza" na frente é o que faz o
 * primeiro chip ser útil para a maioria das pessoas.
 *
 * O `slug` é o que vai para `stores.cuisine_tags` e para a URL do filtro; ele
 * sai do mesmo `slugify()` do resto do sistema, então uma loja marcada pelo
 * painel e um link compartilhado sempre falam a mesma língua.
 */
export type Cuisine = {
  slug: string;
  label: string;
};

export const CUISINES: Cuisine[] = [
  { slug: "lanches", label: "Lanches" },
  { slug: "pizza", label: "Pizza" },
  { slug: "hamburguer", label: "Hambúrguer" },
  { slug: "brasileira", label: "Brasileira" },
  { slug: "marmita", label: "Marmita" },
  { slug: "japonesa", label: "Japonesa" },
  { slug: "acai", label: "Açaí" },
  { slug: "bebidas", label: "Bebidas" },
  { slug: "padaria", label: "Padaria" },
  { slug: "porcoes", label: "Porções" },
  { slug: "churrasco", label: "Churrasco" },
  { slug: "pastel", label: "Pastel" },
  { slug: "salgados", label: "Salgados" },
  { slug: "doces", label: "Doces" },
  { slug: "confeitaria", label: "Confeitaria" },
  { slug: "sorveteria", label: "Sorveteria" },
  { slug: "cafeteria", label: "Cafeteria" },
  { slug: "chinesa", label: "Chinesa" },
  { slug: "arabe", label: "Árabe" },
  { slug: "italiana", label: "Italiana" },
  { slug: "frutos-do-mar", label: "Frutos do mar" },
  { slug: "poke", label: "Poke" },
  { slug: "vegetariana", label: "Vegetariana" },
  { slug: "saudavel", label: "Saudável" },
  { slug: "mexicana", label: "Mexicana" },
  { slug: "conveniencia", label: "Conveniência" },
];

const BY_SLUG = new Map(CUISINES.map((cuisine) => [cuisine.slug, cuisine]));

/**
 * Como o tipo aparece na tela.
 *
 * Uma loja pode ter sido marcada com um tipo que não está no catálogo — o
 * campo aceita texto livre para o caso que ninguém previu. Aí o próprio slug é
 * exibido, que é o que já acontecia antes deste catálogo existir.
 */
export function cuisineLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

/**
 * Ordena por fama, com o que não está no catálogo depois, em ordem alfabética.
 *
 * O `Infinity` mantém os tipos livres agrupados no fim em vez de espalhados —
 * eles são a exceção e não deveriam disputar espaço com "Pizza".
 */
export function sortByPopularity(slugs: string[]): string[] {
  const rank = (slug: string) => {
    const index = CUISINES.findIndex((cuisine) => cuisine.slug === slug);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  return [...slugs].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
