"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, FormError, inputClass } from "@/components/ui";
import { hhmm, WEEKDAYS } from "@/lib/weekdays";
import { emptyFormState } from "@/lib/validation";

import { addStoreHours, deleteStoreHour } from "./actions";

type StoreHour = {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : "Adicionar"}
    </Button>
  );
}

export function HoursEditor({ hours }: { hours: StoreHour[] }) {
  const [state, formAction] = useActionState(addStoreHours, emptyFormState);

  const byWeekday = WEEKDAYS.map((label, weekday) => ({
    label,
    weekday,
    ranges: hours.filter((hour) => hour.weekday === weekday),
  }));

  /*
    Os dias sem horário nenhum já vêm marcados, e é isso que faz a loja nova
    sair de zero num clique: quem abre o painel pela primeira vez encontra a
    semana inteira selecionada, confere as horas e salva. Depois disso o
    padrão vira "o que ainda falta" — sábado e domingo, no caso de quem só
    cadastrou os dias úteis. Quem vai acrescentar a faixa do almoço a um dia
    que já tem a do jantar desmarca o que não quer; é o caso menos comum, e
    o único que pede trabalho.
  */
  const closed = byWeekday
    .filter(({ ranges }) => ranges.length === 0)
    .map(({ weekday }) => weekday);

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Card>
        <ul>
          {byWeekday.map(({ label, weekday, ranges }) => (
            <li
              key={weekday}
              className="flex items-start gap-3 border-t border-neutral-200 px-4 py-3 first:border-t-0 dark:border-neutral-800"
            >
              <span className="w-24 shrink-0 text-sm font-medium">{label}</span>

              {ranges.length === 0 ? (
                <span className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Fechado
                </span>
              ) : (
                <ul className="flex flex-1 flex-col gap-1">
                  {ranges.map((range) => (
                    <li key={range.id} className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {hhmm(range.opens_at)} – {hhmm(range.closes_at)}
                      </span>
                      {range.closes_at < range.opens_at ? (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          (vira o dia)
                        </span>
                      ) : null}
                      <form action={deleteStoreHour} className="ml-auto">
                        <input type="hidden" name="hourId" value={range.id} />
                        <button
                          type="submit"
                          aria-label={`Remover horário de ${label}`}
                          className="rounded-md px-2 text-sm text-neutral-400 transition hover:text-red-600"
                        >
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/*
        A `key` remonta o formulário quando o quadro acima muda — depois de
        salvar, e depois de remover uma faixa. É o que devolve os campos ao
        padrão e recalcula quais dias vêm marcados; sem ela os checkboxes,
        que são do navegador, ficariam com a seleção da gravação anterior.
      */}
      <form
        key={`${state.savedAt ?? 0}-${closed.join(",")}`}
        action={formAction}
        className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700"
      >
        <p className="text-sm font-medium">Adicionar horário</p>

        <div className="flex flex-wrap gap-2">
          {byWeekday.map(({ label, weekday }) => (
            <label key={weekday} className="cursor-pointer select-none">
              <input
                type="checkbox"
                name="weekdays"
                value={weekday}
                defaultChecked={closed.includes(weekday)}
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm transition hover:bg-surface-hover peer-checked:border-neutral-900 peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900 dark:border-neutral-800 dark:peer-checked:border-neutral-200 dark:peer-focus-visible:ring-neutral-200">
                {label.slice(0, 3)}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <input
            name="opensAt"
            type="time"
            defaultValue="18:00"
            required
            aria-label="Abre às"
            className={`${inputClass} w-32`}
          />
          <span className="pb-2.5 text-sm text-neutral-500">até</span>
          <input
            name="closesAt"
            type="time"
            defaultValue="23:00"
            required
            aria-label="Fecha às"
            className={`${inputClass} w-32`}
          />

          <Submit />
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          O mesmo horário vale para todos os dias marcados. Fechar antes de
          abrir vira o dia: 18:00 às 02:00 fica aberta na madrugada. Almoço e
          jantar são duas faixas.
        </p>

        {state.fieldErrors?.weekdays ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.weekdays}
          </p>
        ) : null}
        {state.fieldErrors?.closesAt ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.closesAt}
          </p>
        ) : null}
        <FormError message={state.error} />
      </form>
    </div>
  );
}
