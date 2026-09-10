import type { Metadata } from "next";
import Link from "next/link";

import { LocationHero } from "@/components/location-bar";
import { viewRows, type PublicPlace } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

/**
 * O beco sem saída, com saída.
 *
 * Quem cai aqui não digitou um endereço errado: quase sempre é o link de uma
 * loja que saiu do ar — o cliente que salvou o link, o grupo de WhatsApp que
 * ainda repassa, o Google que indexou antes. Até agora essa pessoa recebia a
 * página padrão do Next: cinza, em inglês, sem nada para fazer.
 *
 * A pergunta dela continua sendo a mesma que a da home — "o que entrega aqui
 * perto?" — então a resposta é a mesma: o campo de CEP e os bairros que já têm
 * loja. Um 404 que devolve o cliente ao catálogo custa uma tela; um que o
 * despacha custa o pedido.
 *
 * `follow: true` de propósito: o Google não deve indexar esta página, mas deve
 * seguir os links dela para encontrar as que valem.
 */
export default async function NotFound() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("neighborhoods_public")
    .select(
      "city, city_slug, neighborhood, neighborhood_slug, state_uf, store_count",
    )
    .order("store_count", { ascending: false })
    .limit(6);

  const places = viewRows<PublicPlace>(data);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Essa página não existe mais.
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Pode ser uma loja que saiu do ar ou um link antigo. O que você
          procurava talvez esteja aqui do lado — informe seu CEP e veja quem
          entrega no seu endereço.
        </p>
      </section>

      <div className="rounded-2xl border border-brand-line bg-brand-soft p-5">
        <LocationHero />
      </div>

      {places.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Ou escolha um bairro
          </h2>

          <ul className="flex flex-wrap gap-2">
            {places.map((place) => (
              <li key={`${place.city_slug}-${place.neighborhood_slug}`}>
                <Link
                  href={`/lojas/${place.city_slug}/${place.neighborhood_slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-surface px-3.5 py-1.5 text-sm transition hover:bg-surface-hover dark:border-neutral-700"
                >
                  {place.neighborhood}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {place.store_count}
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
