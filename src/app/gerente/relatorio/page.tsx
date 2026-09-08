import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { PlanLocked } from "../plan-locked";
import { PrintReport } from "./print-report";

export const metadata: Metadata = {
  title: "Relatório mensal",
  robots: { index: false, follow: false },
};

/**
 * O mês fechado, numa página que dá para guardar.
 *
 * O painel responde "como está indo agora", numa janela deslizante de 30 dias.
 * Isso serve para operar e não serve para comparar: ninguém consegue dizer se
 * agosto foi melhor que julho olhando para "últimos 30 dias".
 *
 * Aqui o intervalo é o mês do calendário, e é por isso que
 * `store_metrics_between` existe — nenhuma quantidade de dias corridos responde
 * "agosto", porque agosto tem 31 e fevereiro tem 28.
 *
 * Só meses **fechados**. Um mês em curso convida a comparar 12 dias com 31, e a
 * conclusão sai errada.
 */

/**
 * As bordas do mês no fuso de Brasília, o mesmo que `store_is_open()` usa.
 *
 * Escrito como offset literal porque o Brasil não tem mais horário de verão:
 * `-03:00` vale o ano inteiro. Sem fixar o fuso, meia-noite seria em UTC e as
 * três primeiras horas de todo dia 1º cairiam no mês anterior.
 */
function monthRange(ym: string): { from: string; to: string } {
  const [year, month] = ym.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  return { from: `${ym}-01T00:00:00-03:00`, to: `${next}-01T00:00:00-03:00` };
}

/** "2026-08" → "agosto de 2026" */
function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/** O mês anterior a `ym`, para comparar e para o link de navegação. */
function shiftMonth(ym: string, by: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** O último mês fechado, em Brasília. */
function lastClosedMonth(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  return shiftMonth(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    -1,
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) {
    return <span className="text-neutral-500">igual ao mês anterior</span>;
  }

  return (
    <span
      className={
        change > 0
          ? "text-green-700 dark:text-green-400"
          : "text-amber-700 dark:text-amber-400"
      }
    >
      {change > 0 ? "↑" : "↓"} {Math.abs(change)}% vs. o mês anterior
    </span>
  );
}

export default async function RelatorioPage({
  searchParams,
}: PageProps<"/gerente/relatorio">) {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("name, plan")
    .eq("id", session.storeId)
    .maybeSingle();

  if (!store) notFound();

  if (store.plan !== "plus") {
    return (
      <div>
        <PageHeader title="Relatório mensal" />
        <PlanLocked
          title="O relatório do mês é do plano Plus"
          description="Uma página por mês fechado, com pedidos, visitas, itens mais pedidos e a comparação com o mês anterior — para guardar, imprimir ou mostrar para o contador. O painel continua mostrando os últimos 30 dias para todo mundo."
        />
      </div>
    );
  }

  const params = await searchParams;
  const raw = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : lastClosedMonth();

  const previousMonth = shiftMonth(month, -1);
  const range = monthRange(month);

  // Lê a soma do mês, com o cru como reserva: `store_month_report` devolve a
  // linha já somada quando ela existe, e conta na hora quando não — o mês que
  // acabou de fechar, antes de a rotina da madrugada passar. Sem isso, o
  // relatório zeraria os meses além da retenção de 90 dias.
  const [current, before, top, confirmations] = await Promise.all([
    supabase.rpc("store_month_report", {
      target: session.storeId,
      month_start: `${month}-01`,
    }),
    supabase.rpc("store_month_report", {
      target: session.storeId,
      month_start: `${previousMonth}-01`,
    }),
    supabase.rpc("store_month_top", {
      target: session.storeId,
      month_start: `${month}-01`,
      max_rows: 10,
    }),
    supabase
      .from("order_confirmations")
      .select("opened, confirmed")
      .eq("store_id", session.storeId)
      .gte("week_start", `${month}-01`)
      .lt("week_start", range.to.slice(0, 10)),
  ]);

  const now = current.data?.[0];
  const then = before.data?.[0];
  const items = top.data ?? [];

  const answered = confirmations.data ?? [];
  const opened = answered.reduce((sum, row) => sum + row.opened, 0);
  const confirmed = answered.reduce((sum, row) => sum + row.confirmed, 0);

  // O mês seguinte só é oferecido se já tiver fechado.
  const hasNext = shiftMonth(month, 1) <= lastClosedMonth();

  return (
    <div className="max-w-2xl">
      <div className="print:hidden">
        <PageHeader
          title="Relatório mensal"
          description="Meses fechados. O painel mostra os últimos 30 dias."
          action={<PrintReport />}
        />

        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href={`/gerente/relatorio?mes=${previousMonth}`}
            className="underline underline-offset-4"
          >
            ← {monthLabel(previousMonth)}
          </Link>
          {hasNext ? (
            <Link
              href={`/gerente/relatorio?mes=${shiftMonth(month, 1)}`}
              className="underline underline-offset-4"
            >
              {monthLabel(shiftMonth(month, 1))} →
            </Link>
          ) : null}
        </div>
      </div>

      <article className="flex flex-col gap-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">
            {store.name}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {monthLabel(month)}
          </p>
        </header>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              Pedidos abertos no WhatsApp
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {now?.whatsapp_clicks ?? 0}
            </dd>
            <dd className="mt-1 text-xs">
              <Delta
                current={now?.whatsapp_clicks ?? 0}
                previous={then?.whatsapp_clicks ?? 0}
              />
            </dd>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              Visitas ao cardápio
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {now?.store_views ?? 0}
            </dd>
            <dd className="mt-1 text-xs">
              <Delta
                current={now?.store_views ?? 0}
                previous={then?.store_views ?? 0}
              />
            </dd>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              Itens adicionados
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {now?.cart_adds ?? 0}
            </dd>
            <dd className="mt-1 text-xs">
              <Delta
                current={now?.cart_adds ?? 0}
                previous={then?.cart_adds ?? 0}
              />
            </dd>
          </div>
        </dl>

        {/* Só aparece quando a própria loja respondeu: sem isso seria um número
            do Petire sobre o trabalho dela. */}
        {opened > 0 ? (
          <p className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            Nas semanas que você respondeu neste mês, {confirmed} de {opened}{" "}
            pedidos abertos chegaram até a loja —{" "}
            <strong>{Math.round((confirmed / opened) * 100)}%</strong>.
          </p>
        ) : null}

        {items.length > 0 ? (
          <section>
            <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              O que mais entrou no carrinho
            </h3>
            <ol className="flex flex-col gap-1.5">
              {items.map((item) => (
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
            </ol>
          </section>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum movimento registrado em {monthLabel(month)}.
          </p>
        )}

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Petire · o pedido fecha no WhatsApp, então estes números contam o que
          sai daqui, não o que a loja faturou.
        </p>
      </article>
    </div>
  );
}
