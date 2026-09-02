"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { addStoreHour, deleteStoreHour } from "./actions";

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

type StoreHour = {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
};

/** "18:00:00" → "18:00" */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : "Adicionar"}
    </Button>
  );
}

export function HoursEditor({ hours }: { hours: StoreHour[] }) {
  const [state, formAction] = useActionState(addStoreHour, emptyFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  const byWeekday = WEEKDAYS.map((label, weekday) => ({
    label,
    weekday,
    ranges: hours.filter((hour) => hour.weekday === weekday),
  }));

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

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700"
      >
        <p className="text-sm font-medium">Adicionar horário</p>

        <div className="flex flex-wrap items-end gap-2">
          <select name="weekday" className={`${inputClass} w-36`}>
            {WEEKDAYS.map((label, weekday) => (
              <option key={weekday} value={weekday}>
                {label}
              </option>
            ))}
          </select>

          <input
            name="opensAt"
            type="time"
            defaultValue="18:00"
            required
            className={`${inputClass} w-32`}
          />
          <span className="pb-2.5 text-sm text-neutral-500">até</span>
          <input
            name="closesAt"
            type="time"
            defaultValue="23:00"
            required
            className={`${inputClass} w-32`}
          />

          <Submit />
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Fechamento antes da abertura significa que a faixa vira o dia — 18:00
          às 02:00 mantém a loja aberta na madrugada. Para almoço e jantar,
          cadastre duas faixas no mesmo dia.
        </p>

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
