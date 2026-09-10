import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { daysSince, STALE_DAYS } from "@/lib/freshness";
import { formatCents } from "@/lib/money";
import { subscriptionNotice } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

import { ConfirmWeek } from "./confirm-week";
import { FirstSteps, type Step } from "./first-steps";
import { PlanLocked } from "./plan-locked";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

/**
 * A variação contra os 30 dias anteriores.
 *
 * Número solto não é acionável: "18 pedidos" não diz se o mês foi bom. O que
 * o lojista precisa saber é se está subindo ou caindo, porque é isso que
 * decide se ele divulga mais ou se procura o Petire para reclamar.
 *
 * Sem base de comparação não se inventa uma: a loja no primeiro mês não tem
 * "mês anterior", e uma seta verde saindo do zero prometeria um crescimento
 * que é só a estreia.
 */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;

  const change = Math.round(((current - previous) / previous) * 100);

  if (change === 0) {
    return (
      <span className="text-neutral-500 dark:text-neutral-400">
        igual aos 30 dias anteriores
      </span>
    );
  }

  return (
    <span
      className={
        change > 0
          ? "text-green-700 dark:text-green-400"
          : "text-amber-700 dark:text-amber-400"
      }
    >
      {change > 0 ? "↑" : "↓"} {Math.abs(change)}% vs. 30 dias anteriores
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  current,
  previous,
}: {
  label: string;
  value: string;
  hint?: string;
  current?: number;
  previous?: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>

      {current !== undefined && previous !== undefined ? (
        <p className="mt-1 text-xs">
          <Delta current={current} previous={previous} />
        </p>
      ) : null}

      {hint ? (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default async function GerentePage() {
  const session = await requireManager();

  // Admin não tem loja, então não há painel de lojista para mostrar.
  if (!session.storeId) {
    redirect("/admin");
  }

  const supabase = await createClient();

  const [
    store,
    products,
    allProducts,
    hours,
    metrics,
    metrics60,
    topProducts,
    unmetDemand,
    paymentsResult,
    isOpen,
    pendingWeek,
    confirmations,
    lastEdit,
  ] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "name, slug, neighborhood, city, logo_url, cuisine_tags, delivery_fee_cents, delivery_minutes, subscription_status, subscription_until, is_active, plan",
      )
      .eq("id", session.storeId)
      .single(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId)
      .eq("is_available", true),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId),
    supabase
      .from("store_hours")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId),
    supabase.rpc("store_metrics", { target: session.storeId }),
    // Os 60 dias menos os 30 recentes dão exatamente o mês anterior, sem
    // precisar de uma função nova nem de datas calculadas no render — a
    // janela continua sendo contada pelo relógio do banco.
    supabase.rpc("store_metrics", {
      target: session.storeId,
      window_days: 60,
    }),
    supabase.rpc("store_top_products", { target: session.storeId }),
    // O que procuram no bairro e este cardápio não atende. Do plano Plus: a
    // função devolve vazio para o Básico, então a tela não precisa checar
    // nada para estar certa — mas checa mesmo assim, para explicar o degrau
    // em vez de mostrar um bloco vazio.
    supabase.rpc("store_unmet_demand", { target: session.storeId }),
    // "Quando eu paguei?" é pergunta que hoje chega por WhatsApp. O RLS já
    // limita à própria loja.
    supabase
      .from("subscription_payments")
      .select("id, paid_on, amount_cents")
      .eq("store_id", session.storeId)
      .order("paid_on", { ascending: false })
      .limit(3),
    supabase.rpc("store_is_open", { target: session.storeId }),
    // A semana fechada que ainda não foi respondida. Vazio quando já
    // respondeu, ou quando não saiu pedido nenhum.
    supabase.rpc("store_pending_confirmation", { target: session.storeId }),
    // A taxa entre o que sai daqui e o que chega lá, das últimas semanas.
    supabase
      .from("order_confirmations")
      .select("opened, confirmed")
      .eq("store_id", session.storeId)
      .order("week_start", { ascending: false })
      .limit(8),
    // Quando o cardápio foi mexido pela última vez.
    supabase
      .from("products")
      .select("updated_at")
      .eq("store_id", session.storeId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const counts = metrics.data?.[0];
  const counts60 = metrics60.data?.[0];

  const previous = {
    clicks: (counts60?.whatsapp_clicks ?? 0) - (counts?.whatsapp_clicks ?? 0),
    views: (counts60?.store_views ?? 0) - (counts?.store_views ?? 0),
  };

  const top = topProducts.data ?? [];
  const demand = unmetDemand.data ?? [];
  const payments = paymentsResult.data ?? [];
  const week = pendingWeek.data?.[0];

  // A taxa só aparece depois que há semana respondida — antes disso ela seria
  // um número inventado sobre o trabalho de outra pessoa.
  const answered = confirmations.data ?? [];
  const totalOpened = answered.reduce((sum, row) => sum + row.opened, 0);
  const totalConfirmed = answered.reduce((sum, row) => sum + row.confirmed, 0);
  const arrivalRate =
    totalOpened > 0 ? Math.round((totalConfirmed / totalOpened) * 100) : null;

  const staleDays = daysSince(lastEdit.data?.updated_at);

  if (store.error || !store.data) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Não foi possível carregar a loja:{" "}
        {store.error?.message ?? "não encontrada"}
      </p>
    );
  }

  const notice = subscriptionNotice(
    store.data.subscription_status,
    store.data.subscription_until,
  );

  // O lojista não consegue se colocar no ar — isso é privilégio de coluna, não
  // esquecimento. O passo aparece assim mesmo para ele saber por que a loja
  // ainda não aparece na vitrine, e que a bola está do outro lado.
  const steps: Step[] = [
    {
      done: (allProducts.count ?? 0) > 0,
      label: "Montar o cardápio",
      hint: "Sem itens não há o que pedir. Dá para colar o cardápio pronto.",
      href: "/gerente/cardapio",
    },
    {
      done: (hours.count ?? 0) > 0,
      label: "Cadastrar os horários",
      hint: "É o que abre e fecha a loja sozinho, todo dia.",
      href: "/gerente/loja",
    },
    {
      done: store.data.delivery_minutes !== null,
      label: "Informar o tempo de entrega",
      hint: "É a pergunta que o cliente faz antes de pedir.",
      href: "/gerente/loja",
    },
    {
      done: (store.data.cuisine_tags ?? []).length > 0,
      label: "Marcar o tipo de culinária",
      hint: "É por ele que o cliente filtra na lista de lojas.",
      href: "/gerente/loja",
    },
    {
      done: store.data.logo_url !== null,
      label: "Colocar a logo",
      hint: "Sem ela a loja aparece como uma letra na lista.",
      href: "/gerente/loja",
    },
    {
      done: store.data.is_active,
      label: "Loja no ar",
      hint: "O Petire libera assim que o cardápio estiver de pé.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {store.data.name}
          </h1>
          <span
            className={
              isOpen.data
                ? "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
            }
          >
            {isOpen.data ? "Aberta agora" : "Fechada"}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {store.data.neighborhood}, {store.data.city} · /loja/{store.data.slug}
        </p>
      </div>

      <FirstSteps steps={steps} />

      {/*
        Cardápio parado é o risco número dois do MVP, e a mitigação até aqui
        ("esgotado em um toque") dependia de o lojista lembrar sozinho. Quem
        avisa agora é o painel — antes de o cliente descobrir pelo preço errado.
      */}
      {staleDays !== null && staleDays >= STALE_DAYS ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium">
            Faz {staleDays} dias que ninguém mexe no cardápio.
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            Preço mudou? Saiu algum item? Cardápio errado é o que faz o cliente
            desistir mais rápido — e ele desiste da loja, não do site.
          </p>
          <Link
            href="/gerente/cardapio"
            className="mt-2 inline-block underline underline-offset-4"
          >
            Conferir o cardápio
          </Link>
        </div>
      ) : null}

      {week ? (
        <ConfirmWeek
          weekStart={week.week_start}
          weekEnd={week.week_end}
          opened={Number(week.opened)}
        />
      ) : null}

      {/*
        Estes números são a única prova de valor que existe: o pedido fecha no
        WhatsApp, fora do sistema. Por isso o rótulo diz exatamente o que foi
        medido. "Pedidos enviados" prometia o que o dado não sustenta — o
        evento é gravado quando o cliente sai para o WhatsApp, e ninguém aqui
        vê se ele apertou enviar. Um número que o lojista desconfia uma vez
        deixa de valer para sempre, e não há um segundo argumento na manga.
      */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Pedidos abertos no WhatsApp"
          value={String(counts?.whatsapp_clicks ?? 0)}
          current={counts?.whatsapp_clicks ?? 0}
          previous={previous.clicks}
          hint={
            arrivalRate === null
              ? "30 dias · o cliente saiu daqui com o pedido escrito"
              : `30 dias · você confirmou que ${arrivalRate}% chegam`
          }
        />
        <Stat
          label="Visitas ao cardápio"
          value={String(counts?.store_views ?? 0)}
          current={counts?.store_views ?? 0}
          previous={previous.views}
          hint="30 dias · uma por visita, não por recarregamento"
        />
        <Stat
          label="Itens disponíveis"
          value={String(products.count ?? 0)}
          hint={`entrega ${formatCents(store.data.delivery_fee_cents)}`}
        />
      </div>

      {/*
        Qual item puxa o pedido. É o único destes números em que o lojista pode
        mexer sozinho — subir o item na lista, fazer promoção nele, garantir
        que não falte. Some no primeiro mês, quando ainda não há o que ranquear.
      */}
      {top.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">O que mais entra no carrinho</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            últimos 30 dias
          </p>

          <ul className="mt-3 flex flex-col gap-1.5">
            {top.map((item) => (
              <li
                key={item.product_id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 text-neutral-500 tabular-nums dark:text-neutral-400">
                  {Number(item.adds)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        O que o bairro procura e este cardápio não tem.

        É o número que só a plataforma enxerga: nenhum lojista sabe o que as
        pessoas digitaram e não acharam perto dele. E é acionável na mesma tela
        — viu açaí na lista, clica em Cardápio e cadastra.

        No Básico o bloco aparece desligado, com a explicação. Item que some do
        painel não é oferta, é dúvida — a mesma regra do PlanLocked.
      */}
      {store.data?.plan === "plus" ? (
        demand.length > 0 ? (
          <div className="rounded-xl border border-brand-line bg-brand-soft p-4">
            <p className="text-sm font-medium">
              Procuram por aqui e você não tem
            </p>
            <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
              últimos 30 dias, na sua cidade
            </p>

            <ul className="mt-3 flex flex-col gap-1.5">
              {demand.map((item) => (
                <li
                  key={item.term}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{item.term}</span>
                  <span className="shrink-0 text-neutral-600 tabular-nums dark:text-neutral-400">
                    {Number(item.hits)}{" "}
                    {Number(item.hits) === 1 ? "busca" : "buscas"}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/gerente/cardapio/produto/novo"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              Cadastrar um item
            </Link>
          </div>
        ) : null
      ) : (
        <PlanLocked
          title="O que procuram no seu bairro é do plano Plus"
          description="O Petire vê o que as pessoas digitam na busca perto de você. Com o Plus, a lista dos itens mais procurados que o seu cardápio não tem aparece aqui — e cadastrar um deles é o caminho mais curto entre uma busca perdida e um pedido."
        />
      )}

      {/*
        Vencimento avisado antes. Quem descobre que venceu porque a loja sumiu
        do catálogo já perdeu os pedidos do dia — e aí a conversa começa com o
        lojista irritado, sobre um problema que um aviso teria evitado.
      */}
      <div
        className={
          notice.tone === "alert"
            ? "rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40"
            : notice.tone === "warn"
              ? "rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40"
              : "rounded-xl border border-neutral-200 bg-surface p-4 text-sm dark:border-neutral-800"
        }
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Assinatura · {notice.title}</p>
          {store.data.subscription_until ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              até{" "}
              {new Date(
                `${store.data.subscription_until}T12:00:00`,
              ).toLocaleDateString("pt-BR")}
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {notice.hint}
        </p>

        {payments.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 border-t border-neutral-200 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3">
                <span>
                  Pago em{" "}
                  {new Date(`${payment.paid_on}T12:00:00`).toLocaleDateString(
                    "pt-BR",
                  )}
                </span>
                <span className="tabular-nums">
                  {formatCents(payment.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/gerente/cardapio">
          <Button>Editar cardápio</Button>
        </Link>
        <Link href="/gerente/loja">
          <Button variant="secondary">Dados da loja</Button>
        </Link>
      </div>
    </div>
  );
}
