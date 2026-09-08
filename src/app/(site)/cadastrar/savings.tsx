"use client";

import { useState } from "react";

import { Field, inputClass } from "@/components/ui";
import { formatCents, parseToCents } from "@/lib/money";
import { BASIC_PRICE_CENTS, dailyCents, monthlySavings } from "@/lib/pricing";

/**
 * A conta que abre a conversa.
 *
 * "Sem comissão" é uma frase; a comissão que ele pagou no mês passado é um
 * número, e é o número que faz o dono parar de mexer na chapa para olhar a
 * tela. O argumento inteiro do Petire estava escrito no site como adjetivo.
 *
 * Os dois campos são **dele**, de propósito. O Petire não sabe a taxa que o
 * aplicativo cobra de cada loja — ela muda com o plano, com a entrega ser do
 * app ou da casa, e com o que cada um negociou. Chutar um percentual e chamar
 * de "o seu" é perder a conversa no instante em que ele abre o extrato.
 */
export function SavingsCalculator() {
  const [revenue, setRevenue] = useState("");
  const [percent, setPercent] = useState("23");

  const revenueCents = parseToCents(revenue);
  const result = monthlySavings({
    revenueCents: revenueCents ?? 0,
    commissionPercent: Number(percent.replace(",", ".")),
    priceCents: BASIC_PRICE_CENTS,
  });

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface p-5 dark:border-neutral-800">
      <h2 className="font-medium">Quanto a comissão te custa hoje</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Os dois números são seus — estão no extrato do aplicativo. O Petire não
        chuta a sua taxa.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Seu faturamento no aplicativo, por mês"
          hint="Só o que passa pelo app, não a loja inteira."
        >
          <input
            value={revenue}
            onChange={(event) => setRevenue(event.target.value)}
            inputMode="decimal"
            placeholder="5.000,00"
            className={inputClass}
          />
        </Field>

        <Field
          label="Comissão que ele cobra (%)"
          hint="Costuma ficar entre 12% e 30%, conforme quem faz a entrega."
        >
          <input
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      {result ? (
        <div className="mt-4 rounded-lg bg-background p-4">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-400">
                Comissão no mês
              </dt>
              <dd className="font-medium">
                {formatCents(result.commissionCents)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-neutral-600 dark:text-neutral-400">
                Petire no mês
              </dt>
              <dd className="font-medium">{formatCents(result.petireCents)}</dd>
            </div>
          </dl>

          {result.monthlyCents > 0 ? (
            <p className="mt-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
              A diferença é{" "}
              <strong className="text-brand">
                {formatCents(result.monthlyCents)} por mês
              </strong>
              , ou {formatCents(result.yearlyCents)} no ano.
            </p>
          ) : (
            /*
              Faturamento baixo no app: a comissão dele não chega à
              mensalidade. Inflar isso em "economia" seria a promessa que o
              primeiro extrato desmente — e é a loja pequena, justamente, que
              cancela quando se sente enganada.
            */
            <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              Nesse volume a comissão ainda é menor que a mensalidade. O que o
              Petire te dá aqui é o cardápio online e o pedido pronto no
              WhatsApp — a economia vem quando o movimento pelo app cresce.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Não usa aplicativo nenhum? Então a conta é outra:{" "}
          {formatCents(BASIC_PRICE_CENTS)} por mês dá{" "}
          <strong>{formatCents(dailyCents(BASIC_PRICE_CENTS))} por dia</strong>,
          e o cliente que pede continua sendo seu.
        </p>
      )}

      {/*
        A objeção que mata a venda vem antes de ser dita, e ela é sempre a
        mesma: "mas eu não vou sair do iFood". Ninguém está pedindo isso.
      */}
      <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
        O Petire não substitui o aplicativo. A maior parte das lojas usa os
        dois e manda para cá o cliente que já é dela — o do bairro, o do
        cartaz, o que ela atende no WhatsApp desde antes. Nesse pedido não
        entra comissão.
      </p>
    </section>
  );
}
