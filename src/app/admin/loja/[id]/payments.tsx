"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, FormError, inputClass } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { emptyFormState } from "@/lib/validation";

import { registerPayment } from "../../actions";

/**
 * O caderninho da mensalidade.
 *
 * A cobrança é PIX conferido a mão, e o trabalho cresce em linha reta com o
 * número de lojas. O que doía não era o valor: era não haver resposta para
 * "quando ele pagou da última vez?" — a data anterior era sobrescrita pela
 * seguinte e não sobrava rastro.
 *
 * Registrar o pagamento e mover o vencimento acontecem juntos de propósito.
 * Fazer só o primeiro tira do ar uma loja que pagou, e isso é o tipo de erro
 * que o lojista descobre pelo cliente.
 */

export type Payment = {
  id: number;
  amount_cents: number;
  paid_on: string;
  covers_until: string;
  note: string | null;
};

function brDate(date: string): string {
  // Meio-dia para o fuso não empurrar a data um dia para trás na exibição.
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Registrando…" : "Registrar pagamento"}
    </Button>
  );
}

export function Payments({
  storeId,
  suggestedUntil,
  payments,
}: {
  storeId: string;
  /** Um mês à frente do vencimento atual: é o caso normal, e poupa digitação. */
  suggestedUntil: string;
  payments: Payment[];
}) {
  const [state, formAction] = useActionState(registerPayment, emptyFormState);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="max-w-lg">
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        Mensalidade
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Registrar o pagamento move o vencimento da loja e marca a assinatura
        como em dia.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="storeId" value={storeId} />

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Valor
            </span>
            <input
              name="amount"
              defaultValue={state.values?.amount ?? "30,00"}
              inputMode="decimal"
              className={`${inputClass} w-28 py-2 text-sm`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Pago em
            </span>
            <input
              type="date"
              name="paidOn"
              defaultValue={state.values?.paidOn ?? today}
              className={`${inputClass} w-40 py-2 text-sm`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Cobre até
            </span>
            <input
              type="date"
              name="coversUntil"
              defaultValue={state.values?.coversUntil ?? suggestedUntil}
              className={`${inputClass} w-40 py-2 text-sm`}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Observação (opcional)
          </span>
          <input
            name="note"
            defaultValue={state.values?.note ?? ""}
            maxLength={200}
            placeholder="PIX, comprovante enviado no grupo"
            className={`${inputClass} py-2 text-sm`}
          />
        </label>

        <div className="flex items-center gap-3">
          <Submit />
          {state.savedAt && !state.error ? (
            <span className="text-sm text-green-700 dark:text-green-400">
              registrado
            </span>
          ) : null}
        </div>

        <FormError message={state.error} />
      </form>

      {payments.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {payments.map((payment) => (
            <li key={payment.id} className="text-sm">
              <div className="flex justify-between gap-3">
                <span>{brDate(payment.paid_on)}</span>
                <span className="tabular-nums">
                  {formatCents(payment.amount_cents)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                cobre até {brDate(payment.covers_until)}
                {payment.note ? ` · ${payment.note}` : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 border-t border-neutral-200 pt-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          Nenhum pagamento registrado ainda.
        </p>
      )}
    </section>
  );
}
