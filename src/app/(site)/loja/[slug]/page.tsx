import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";

import { siteUrl } from "@/lib/env";
import { formatDeliveryTime } from "@/lib/delivery";
import { jsonLdScript } from "@/lib/json-ld";
import { precoACombinar, startingPrice } from "@/lib/menu-price";
import { fazEntrega, fazRetirada } from "@/lib/service-mode";
import { formatCents, formatDeliveryFee } from "@/lib/money";
import { priceOf, type Promotion } from "@/lib/promotions";
import { fetchAllRows } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";
import { hhmm, SCHEMA_WEEKDAYS, WEEKDAYS } from "@/lib/weekdays";

import { CartBar } from "./cart-bar";
import { findRenamedStore, getStorePage, type StorePage } from "./data";
import { MenuBrowser, type MenuSection } from "./menu-browser";
import { TrackStoreView } from "./track-view";

// Rede de segurança. O caminho normal é o painel chamar revalidatePath assim
// que o cardápio muda — ver refreshMenu() em gerente/cardapio/actions.ts.
export const revalidate = 3600;

/**
 * Todas as lojas ganham página estática no build.
 *
 * Paginado pelo mesmo motivo do sitemap: o PostgREST corta na milésima linha em
 * silêncio, e a loja cortada perdia a versão pré-renderizada — continuaria
 * abrindo, por ISR, só que mais devagar e sem estar pronta quando o Google
 * passasse.
 *
 * Se um dia o catálogo crescer a ponto de o build incomodar, o caminho é
 * pré-renderizar as mais movimentadas e deixar o resto sob demanda. Enquanto
 * são centenas, gerar todas custa menos que decidir quais.
 */
export async function generateStaticParams() {
  const supabase = createPublicClient();

  return fetchAllRows<{ slug: string }>((from, to) =>
    supabase.from("stores_public").select("slug").order("slug").range(from, to),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/loja/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStorePage(slug);

  if (!page) return { title: "Loja não encontrada" };

  const { store } = page;
  const title = `${store.name} — ${store.neighborhood}, ${store.city}`;
  const description =
    store.description ??
    `Cardápio e preços de ${store.name} em ${store.neighborhood}. Peça direto no WhatsApp, sem taxa de serviço.`;

  return {
    title,
    description,
    alternates: { canonical: `/loja/${store.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${siteUrl}/loja/${store.slug}`,
      images: store.cover_url ?? store.logo_url ?? undefined,
    },
  };
}

/**
 * JSON-LD para o Google entender que isto é um restaurante do bairro, com
 * cardápio e horário. É o que faz a página aparecer na busca local — o canal
 * de aquisição que o Petire tem de graça.
 */
function storeJsonLd({ store, hours, products }: StorePage) {
  /*
    Faixa de preço, cardápio e coordenadas: os três campos que faltavam para o
    Google montar o resultado rico — o que ocupa mais espaço na tela do que o
    link de um concorrente.

    A faixa sai dos preços de verdade, e não de um "$$" escolhido a dedo: ela
    se corrige sozinha quando o lojista mexe no cardápio, e é o que responde a
    quem procura lanche por menos de vinte reais.
  */
  // O piso é o preço de entrada, não o preço-base: um item que custa R$ 0,00
  // até o cliente escolher o tamanho faria a loja anunciar "a partir de zero"
  // no resultado do Google. Ver src/lib/menu-price.ts.
  //
  // E o item sem preço fica de fora da conta. Uma lanchonete de produção subiu
  // cinco itens a R$ 0,00 esperando a regra de "escolha o tamanho", e a loja
  // inteira passou a anunciar ao Google uma faixa começando em R$ 0,00 — que
  // atrai o clique errado e entrega uma decepção. Ver precoACombinar().
  const precos = products
    .map((produto) =>
      startingPrice(
        produto.price_cents,
        produto.product_option_groups.map((link) => link.option_groups),
      ),
    )
    .filter((preco) => !precoACombinar(preco))
    .map((preco) => preco.cents);

  const priceRange =
    precos.length > 0
      ? `${formatCents(Math.min(...precos))} - ${formatCents(Math.max(...precos))}`
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: store.name,
    description: store.description ?? undefined,
    url: `${siteUrl}/loja/${store.slug}`,
    image: store.cover_url ?? store.logo_url ?? undefined,
    telephone: `+${store.whatsapp_e164}`,
    servesCuisine: store.cuisine_tags?.length ? store.cuisine_tags : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address ?? undefined,
      addressLocality: store.city,
      addressRegion: store.neighborhood,
      addressCountry: "BR",
    },
    priceRange,
    // O cardápio é esta mesma página: quem chega pelo resultado do Google já
    // cai onde monta o pedido.
    hasMenu: `${siteUrl}/loja/${store.slug}`,
    // Só quando existem. Coordenada inventada manda o cliente para a esquina
    // errada — e é a partir dela que o Google desenha o mapa.
    geo:
      store.lat !== null && store.lng !== null
        ? {
            "@type": "GeoCoordinates",
            latitude: store.lat,
            longitude: store.lng,
          }
        : undefined,
    openingHoursSpecification: hours.map((hour) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_WEEKDAYS[hour.weekday],
      opens: hhmm(hour.opens_at),
      closes: hhmm(hour.closes_at),
    })),
  };
}

export default async function LojaPage({ params }: PageProps<"/loja/[slug]">) {
  const { slug } = await params;
  const page = await getStorePage(slug);

  if (!page) {
    // Pode ser um apelido antigo desta loja: o cliente salvou o link e o
    // Google indexou. Redireciona em vez de dar 404.
    const current = await findRenamedStore(slug);
    if (current) permanentRedirect(`/loja/${current}`);
    notFound();
  }

  const { store, categories, products, hours, promotions } = page;

  // O preço com promoção e a ordenação das opções são resolvidos aqui, no
  // servidor: o MenuBrowser filtra e navega, e não tem por que saber de
  // promoção nem de `sort_order`.
  const toMenuProduct = (product: (typeof products)[number]) => {
    const price = priceOf(
      product.price_cents,
      product.id,
      promotions as Promotion[],
    );

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      is_available: product.is_available,
      priceCents: price.cents,
      originalPriceCents: price.originalCents,
      promotionLabel: price.label,
      // O PostgREST não ordena relações aninhadas junto com a principal.
      //
      // A ordem dos grupos é a da **ligação**, e não a do grupo: o mesmo
      // "Tamanho" pode vir antes dos adicionais num item e depois deles em
      // outro. A tabela do meio some aqui — quem monta o cardápio quer os
      // grupos deste item, não a história de como eles são compartilhados.
      option_groups: [...product.product_option_groups]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((link) => link.option_groups)
        .map((group) => ({
          ...group,
          options: [...group.options].sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
        })),
    };
  };

  const sections: MenuSection[] = [
    ...categories.map((category) => ({
      // O índice do cardápio precisa de um id em toda seção, inclusive na de
      // itens sem categoria — é o alvo do link e a chave do estado.
      id: category.id as string,
      name: category.name,
      items: products
        .filter((p) => p.category_id === category.id)
        .map(toMenuProduct),
    })),
    {
      id: "outros",
      name: "Outros",
      items: products.filter((p) => p.category_id === null).map(toMenuProduct),
    },
  ].filter((section) => section.items.length > 0);

  const hoursByWeekday = WEEKDAYS.map((label, weekday) => ({
    label,
    ranges: hours.filter((hour) => hour.weekday === weekday),
  }));

  return (
    <div className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        // `jsonLdScript`, e não `JSON.stringify`: o nome e a descrição da loja são
        // digitados no painel, e o analisador de HTML fecha a tag em qualquer
        // `</script` que apareça. Ver src/lib/json-ld.ts.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(storeJsonLd(page)) }}
      />
      <TrackStoreView storeId={store.id} />

      <header className="flex flex-col gap-4">
        {/*
          Sem capa, uma faixa da cor da marca no lugar do nada.

          A loja que não subiu capa abria com o nome colado no topo branco, e
          a página parecia inacabada antes de o cliente ler uma linha. A faixa
          não finge ser foto — é lisa, e some atrás da capa de verdade assim
          que o lojista mandar uma. É a mesma ideia da logo no lugar da foto
          do item: o vazio vira presença da marca, não buraco.
        */}
        {store.cover_url ? (
          <div className="relative -mx-4 aspect-[3/1] overflow-hidden sm:mx-0 sm:rounded-xl">
            <Image
              src={store.cover_url}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="-mx-4 h-20 bg-gradient-to-b from-brand-soft to-background sm:mx-0 sm:rounded-xl"
          />
        )}

        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            {store.logo_url ? (
              <Image
                src={store.logo_url}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-semibold text-neutral-300 dark:text-neutral-700">
                {store.name.charAt(0)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {store.name}
              </h1>
              <span
                className={
                  store.is_open_now
                    ? "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                    : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                }
              >
                {store.is_open_now ? "Aberta agora" : "Fechada"}
              </span>
            </div>

            {store.description ? (
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                {store.description}
              </p>
            ) : null}

            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {store.address ? `${store.address} · ` : null}
              {store.neighborhood}, {store.city}
            </p>

            {/*
              A loja que não entrega não pode ter uma linha começando com
              "Entrega": o cliente lê a primeira palavra e monta o pedido
              esperando receber em casa. Aqui ele lê "Retirada no balcão" antes
              de escolher o primeiro item.
            */}
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {fazEntrega(store.service_mode) ? (
                <>
                  Entrega {formatDeliveryFee(store.delivery_fee_cents)}
                  {formatDeliveryTime(store.delivery_minutes)
                    ? ` · ${formatDeliveryTime(store.delivery_minutes)}`
                    : null}
                  {fazRetirada(store.service_mode)
                    ? " · ou retire no balcão"
                    : null}
                </>
              ) : (
                "Retirada no balcão — esta loja não entrega"
              )}
              {store.min_order_cents > 0
                ? ` · pedido mínimo ${formatCents(store.min_order_cents)}`
                : null}
            </p>
          </div>
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Esta loja ainda não publicou o cardápio.
        </p>
      ) : (
        <MenuBrowser
          storeId={store.id}
          storeIsOpen={store.is_open_now}
          sections={sections}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          Horário
        </h2>
        <ul className="rounded-xl border border-neutral-200 bg-surface dark:border-neutral-800">
          {hoursByWeekday.map(({ label, ranges }) => (
            <li
              key={label}
              className="flex justify-between gap-4 border-t border-neutral-200 px-4 py-2.5 text-sm first:border-t-0 dark:border-neutral-800"
            >
              <span>{label}</span>
              <span className="text-neutral-500 tabular-nums dark:text-neutral-400">
                {ranges.length === 0
                  ? "Fechado"
                  : ranges
                      .map((r) => `${hhmm(r.opens_at)}–${hhmm(r.closes_at)}`)
                      .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <CartBar />
    </div>
  );
}
