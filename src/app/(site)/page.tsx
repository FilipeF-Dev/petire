import Link from "next/link";

import { viewRows, type PublicPlace } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

// A home muda quando entra loja nova. Uma hora de defasagem é aceitável aqui —
// o que não pode atrasar é o cardápio, que revalida sob demanda.
export const revalidate = 3600;

export default async function HomePage() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("neighborhoods_public")
    .select("city, city_slug, neighborhood, neighborhood_slug, state_uf, store_count")
    .order("store_count", { ascending: false });

  const places = viewRows<PublicPlace>(data);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Peça direto da loja do seu bairro.
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Monte seu pedido e feche no WhatsApp da loja. Sem taxa de serviço,
          cadastro, propaganda ou burocracia.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          Onde você está
        </h2>

        {places.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {places.map((place) => (
              <li key={`${place.city}-${place.neighborhood}`}>
                <Link
                  href={{
                    pathname: "/lojas",
                    query: {
                      cidade: place.city_slug,
                      bairro: place.neighborhood_slug,
                    },
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface px-4 py-3.5 transition hover:bg-surface-hover dark:border-neutral-800"
                >
                  <span>
                    <span className="font-medium">{place.neighborhood}</span>
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                      {place.city}
                      {place.state_uf ? ` · ${place.state_uf}` : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
                    {place.store_count}{" "}
                    {place.store_count === 1 ? "loja" : "lojas"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            Ainda não há lojas cadastradas.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-surface p-5 dark:border-neutral-800">
        <h2 className="font-medium">Tem uma lanchonete ou distribuidora?</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Sem comissão por pedido: mensalidade fixa, e o cliente fala direto
          com você.
        </p>
        <Link
          href="/entrar"
          className="mt-3 inline-block text-sm underline underline-offset-4"
        >
          Entrar no painel do lojista
        </Link>
      </section>
    </div>
  );
}
