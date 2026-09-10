import Link from "next/link";

import { InstallPrompt } from "@/components/install-prompt";
import { LocationHero } from "@/components/location-bar";
import { OrderAgain } from "@/components/order-again";
import { formatCents } from "@/lib/money";
import {
  BASIC_PRICE_CENTS,
  FOUNDER_PRICE_CENTS,
  FOUNDER_SLOTS,
} from "@/lib/pricing";
import { viewRows, type PublicPlace } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

// A home muda quando entra loja nova. Uma hora de defasagem é aceitável aqui —
// o que não pode atrasar é o cardápio, que revalida sob demanda.
export const revalidate = 3600;

export default async function HomePage() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("neighborhoods_public")
    .select(
      "city, city_slug, neighborhood, neighborhood_slug, state_uf, store_count",
    )
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

        {/*
          O bloco do endereço ganhou fundo tingido: é a primeira pergunta da
          página e era um campo solto sobre o creme, indistinguível do resto.
          A cor aqui não decora — ela diz onde a tela começa.
        */}
        <div className="mt-6 rounded-2xl border border-brand-line bg-brand-soft p-5">
          <LocationHero />
        </div>
      </section>

      {/*
        Antes de qualquer lista: quem já pediu volta por aqui, num toque. A
        seção não existe no HTML estático — ela é montada do localStorage do
        cliente depois da hidratação, e some para quem nunca pediu.
      */}
      <OrderAgain />

      {/* Só para quem já pediu: o valor precisa vir antes do convite. */}
      <InstallPrompt />

      {/*
        A lista de bairros deixou de ser a porta de entrada — o CEP faz o que
        ela fazia e ainda preenche o endereço da entrega — mas continua aqui,
        mais discreta, por dois motivos: quem não quer digitar o CEP tem por
        onde entrar, e são estes links que dão ao Google um caminho para cada
        cidade e bairro atendidos. Busca é o canal de aquisição gratuito do
        Petire.
      */}
      {places.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
            Busque por bairro
          </h2>

          <ul className="flex flex-col gap-2">
            {places.map((place) => (
              <li key={`${place.city_slug}-${place.neighborhood_slug}`}>
                <Link
                  // `perto`, não `bairro`: filtrar por bairro exato esconderia
                  // a lanchonete do Centro que entrega no bairro inteiro. Ele
                  // ordena, e é a mesma regra que o CEP usa.
                  href={{
                    pathname: "/lojas",
                    query: {
                      cidade: place.city_slug,
                      perto: place.neighborhood_slug,
                    },
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-sm transition hover:bg-surface-hover dark:border-neutral-800"
                >
                  <span>
                    <span className="font-medium">{place.neighborhood}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {" · "}
                      {place.city}
                      {place.state_uf ? `, ${place.state_uf}` : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
                    {place.store_count}{" "}
                    {place.store_count === 1 ? "loja" : "lojas"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Ainda não há lojas cadastradas.
        </p>
      )}

      {/* O convite ao lojista fecha a página, e é o único bloco dela que fala
          com outra pessoa. O tingimento o separa do que veio antes sem
          precisar de linha divisória nem de tipografia maior. */}
      <section className="rounded-2xl border border-brand-line bg-brand-soft p-5">
        <h2 className="font-medium">Tem uma lanchonete ou distribuidora?</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Sem comissão por pedido: {formatCents(BASIC_PRICE_CENTS)} por mês, e o
          cliente fala direto com você. As {FOUNDER_SLOTS} primeiras de cada
          bairro entram por {formatCents(FOUNDER_PRICE_CENTS)}.
        </p>
        {/*
          Eram dois links sublinhados. Minimalismo não é o mesmo que esconder a
          ação: o lojista que chegou até aqui já decidiu ler, e precisa ver onde
          clicar sem procurar. O peso separa os dois — cadastrar é a ação da
          página, entrar é para quem já é de casa.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/cadastrar"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Cadastrar minha loja
          </Link>
          <Link
            href="/entrar"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-surface-hover dark:border-neutral-700"
          >
            Já tenho conta
          </Link>
        </div>
      </section>
    </div>
  );
}
