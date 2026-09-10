import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cuisineLabel, sortByPopularity } from "@/lib/cuisines";
import { humanizePlace } from "@/lib/slug";
import {
  CARD_SELECT,
  fetchAllRows,
  viewRows,
  type PublicPlace,
  type PublicStoreCard,
} from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

import { StoreList } from "../../store-list";

/**
 * A página do bairro.
 *
 * Ninguém digita "petire" no Google. Digita "lanche em Bandeirantes",
 * "hambúrguer Juiz de Fora delivery", "distribuidora perto de mim". Esta é a
 * página que responde a isso, e até agora ela existia na forma que o Google
 * menos aproveita: um parâmetro de busca (`/lojas?cidade=&bairro=`) numa rota
 * renderizada a cada visita, com o título genérico de todas as outras.
 *
 * Aqui ela é um endereço próprio, gerado no build como a página da loja, com
 * título, texto e H1 que falam de um bairro só. `/lojas` continua existindo e
 * continua sendo o lugar de filtrar e buscar — o que muda é que a porta de
 * entrada do Google deixou de ser uma tela de filtros.
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createPublicClient();

  const places = await fetchAllRows<{
    city_slug: string;
    neighborhood_slug: string;
  }>((from, to) =>
    supabase
      .from("neighborhoods_public")
      .select("city_slug, neighborhood_slug")
      .order("city_slug")
      .order("neighborhood_slug")
      .range(from, to),
  );

  return places
    .filter((place) => place.city_slug && place.neighborhood_slug)
    .map((place) => ({
      cidade: place.city_slug,
      bairro: place.neighborhood_slug,
    }));
}

/** O bairro, com a grafia oficial e as lojas que entregam nele. */
async function getBairro(cidade: string, bairro: string) {
  const supabase = createPublicClient();

  const [placeResult, storesResult] = await Promise.all([
    supabase
      .from("neighborhoods_public")
      .select(
        "city, city_slug, neighborhood, neighborhood_slug, state_uf, store_count",
      )
      .eq("city_slug", cidade)
      .eq("neighborhood_slug", bairro)
      .maybeSingle(),
    supabase
      .from("stores_public")
      .select(CARD_SELECT)
      .eq("city_slug", cidade)
      .eq("neighborhood_slug", bairro)
      .order("is_open_now", { ascending: false })
      .order("name"),
  ]);

  const place = placeResult.data as PublicPlace | null;
  if (!place) return null;

  return { place, stores: viewRows<PublicStoreCard>(storesResult.data) };
}

/**
 * "Lanchonetes", "Distribuidoras", ou os dois.
 *
 * Sai do que o bairro tem, e não de um rótulo fixo: prometer lanchonete onde
 * só há distribuidora é a diferença entre a página responder à busca e
 * decepcionar quem clicou.
 */
function tipoDoBairro(stores: PublicStoreCard[]): string {
  const temComida = stores.some((s) => s.kind === "food" || s.kind === "both");
  const temBebida = stores.some(
    (s) => s.kind === "drinks" || s.kind === "both",
  );

  if (temComida && temBebida) return "Lanchonetes e distribuidoras";
  if (temBebida) return "Distribuidoras";
  return "Lanchonetes";
}

export async function generateMetadata({
  params,
}: PageProps<"/lojas/[cidade]/[bairro]">): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const data = await getBairro(cidade, bairro);

  if (!data) {
    return { title: `Lojas em ${humanizePlace(bairro)}` };
  }

  const { place, stores } = data;
  const onde = `${place.neighborhood}, ${place.city}`;
  const tipo = tipoDoBairro(stores);

  return {
    title: `${tipo} em ${onde}`,
    // Mesmo cuidado com o artigo do bairro que o texto da página: o nome vem
    // primeiro, e a frase serve para "Centro" e para "Vila Madalena".
    description: `${place.neighborhood} tem ${place.store_count} ${place.store_count === 1 ? "loja" : "lojas"} no Petire. Veja o cardápio, monte o pedido e feche direto no WhatsApp da loja — sem taxa de serviço.`,
    alternates: { canonical: `/lojas/${cidade}/${bairro}` },
  };
}

export default async function BairroPage({
  params,
}: PageProps<"/lojas/[cidade]/[bairro]">) {
  const { cidade, bairro } = await params;
  const data = await getBairro(cidade, bairro);

  if (!data) notFound();

  const { place, stores } = data;
  const supabase = createPublicClient();

  // Os outros bairros da mesma cidade, para o cliente que errou o bairro e
  // para o Google chegar às páginas vizinhas sem passar pela home.
  const { data: vizinhosData } = await supabase
    .from("neighborhoods_public")
    .select("neighborhood, neighborhood_slug, store_count")
    .eq("city_slug", cidade)
    .neq("neighborhood_slug", bairro)
    .order("store_count", { ascending: false })
    .limit(12);

  const vizinhos = vizinhosData ?? [];

  // O que se come aqui, na ordem em que cada tipo aparece num bairro.
  const tags = sortByPopularity([
    ...new Set(stores.flatMap((store) => store.cuisine_tags ?? [])),
  ]).slice(0, 6);

  /*
    A que horas o bairro abre.

    Vem do horário das lojas, e não de um texto escrito à mão: é a informação
    que quem procura às 22h precisa antes de tudo, e ela envelhece sozinha se
    for digitada uma vez.
  */
  const { data: horas } = await supabase
    .from("store_hours")
    .select("store_id, weekday, opens_at")
    .in(
      "store_id",
      stores.map((store) => store.id),
    );

  const abertura = maisComum(
    (horas ?? []).map((hora) => hora.opens_at.slice(0, 5)),
  );

  const tipo = tipoDoBairro(stores);
  const abertas = stores.filter((store) => store.is_open_now).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/lojas" className="underline-offset-4 hover:underline">
            Lojas
          </Link>
          {" · "}
          {place.city}
          {place.state_uf ? `, ${place.state_uf}` : null}
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {tipo} em {place.neighborhood}, {place.city}
        </h1>

        {/*
          Frases escritas a partir do que o bairro tem agora. É o que faz a
          página responder a uma pergunta em vez de ser uma lista — e é o que o
          Google lê para decidir que ela responde.

          O nome do bairro vem primeiro, e isso é gramática e não estilo: em
          português o artigo muda com o gênero do nome — "no Centro", "na Vila
          Madalena" — e nenhum código adivinha qual é. Com o nome liderando, a
          frase funciona para qualquer bairro do país.
        */}
        <p className="text-neutral-600 dark:text-neutral-400">
          {place.neighborhood} tem{" "}
          {place.store_count === 1 ? "uma loja" : `${place.store_count} lojas`}{" "}
          no Petire
          {tags.length > 0 ? (
            <>
              {": "}
              {tags.map((tag) => cuisineLabel(tag).toLowerCase()).join(", ")}
            </>
          ) : null}
          . {abertura ? `A maioria abre às ${abertura}. ` : null}
          Você monta o pedido no cardápio e fecha direto no WhatsApp da loja,
          sem taxa de serviço e sem cadastro.
        </p>

        {abertas > 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {abertas === 1
              ? "1 loja está aberta agora."
              : `${abertas} lojas estão abertas agora.`}
          </p>
        ) : null}
      </div>

      <StoreList stores={stores} nearSlug={null} />

      {vizinhos.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Outros bairros de {place.city}
          </h2>

          <ul className="flex flex-wrap gap-2">
            {vizinhos.map((vizinho) => (
              <li key={vizinho.neighborhood_slug}>
                <Link
                  href={`/lojas/${cidade}/${vizinho.neighborhood_slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-surface px-3.5 py-1.5 text-sm transition hover:bg-surface-hover dark:border-neutral-700"
                >
                  {vizinho.neighborhood}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {vizinho.store_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** O horário que mais se repete entre as lojas. Nulo quando não há nenhum. */
function maisComum(valores: string[]): string | null {
  const contagem = new Map<string, number>();
  for (const valor of valores) {
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }

  let melhor: string | null = null;
  let maior = 0;
  for (const [valor, vezes] of contagem) {
    if (vezes > maior) {
      melhor = valor;
      maior = vezes;
    }
  }

  return melhor;
}
