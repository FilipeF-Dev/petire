import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { siteUrl } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { priceOf, type Promotion } from "@/lib/promotions";
import { viewRows } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";
import { hhmm, SCHEMA_WEEKDAYS, WEEKDAYS } from "@/lib/weekdays";

import { getStorePage, type StorePage } from "./data";
import { TrackStoreView } from "./track-view";

// Rede de segurança. O caminho normal é o painel chamar revalidatePath assim
// que o cardápio muda — ver refreshMenu() em gerente/cardapio/actions.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("stores_public").select("slug");
  return viewRows<{ slug: string }>(data);
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
function storeJsonLd({ store, hours }: StorePage) {
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

  if (!page) notFound();

  const { store, categories, products, hours, promotions } = page;

  const sections = [
    ...categories.map((category) => ({
      id: category.id as string | null,
      name: category.name,
      items: products.filter((p) => p.category_id === category.id),
    })),
    {
      id: null,
      name: "Outros",
      items: products.filter((p) => p.category_id === null),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd(page)) }}
      />
      <TrackStoreView storeId={store.id} />

      <header className="flex flex-col gap-4">
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
        ) : null}

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

            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Entrega{" "}
              {store.delivery_fee_cents === 0
                ? "grátis"
                : formatCents(store.delivery_fee_cents)}
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
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.id ?? "outros"}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                {section.name}
              </h2>

              <ul className="flex flex-col gap-2">
                {section.items.map((product) => {
                  const price = priceOf(
                    product.price_cents,
                    product.id,
                    promotions as Promotion[],
                  );

                  // Grupo obrigatório com opção paga significa que o preço da
                  // vitrine é um piso, não o total.
                  const startsFrom = product.option_groups.some(
                    (group) =>
                      group.min_select >= 1 &&
                      group.options.every(
                        (option) =>
                          !option.is_available || option.price_delta_cents > 0,
                      ),
                  );

                  return (
                    <li
                      key={product.id}
                      className={`flex gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 ${
                        product.is_available ? "" : "opacity-55"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{product.name}</h3>
                          {product.is_available ? null : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              esgotado
                            </span>
                          )}
                          {price.label ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                              {price.label}
                            </span>
                          ) : null}
                        </div>

                        {product.description ? (
                          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                            {product.description}
                          </p>
                        ) : null}

                        <p className="mt-2 flex flex-wrap items-baseline gap-2">
                          {startsFrom ? (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              a partir de
                            </span>
                          ) : null}
                          <span className="font-medium tabular-nums">
                            {formatCents(price.cents)}
                          </span>
                          {price.originalCents !== null ? (
                            <span className="text-sm text-neutral-400 line-through tabular-nums">
                              {formatCents(price.originalCents)}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {product.image_url ? (
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                          <Image
                            src={product.image_url}
                            alt=""
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          Horário
        </h2>
        <ul className="rounded-xl border border-neutral-200 dark:border-neutral-800">
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

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        O carrinho e o envio do pedido pelo WhatsApp chegam na próxima fase.
      </p>
    </div>
  );
}
