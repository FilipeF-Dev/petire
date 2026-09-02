"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import {
  resetManagerPassword,
  setSubscription,
  type NewStoreState,
} from "./actions";

const STATUSES = [
  { value: "trial", label: "Teste" },
  { value: "active", label: "Em dia" },
  { value: "past_due", label: "Atrasada" },
  { value: "suspended", label: "Suspensa" },
] as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

export function SubscriptionForm({
  storeId,
  status,
  until,
}: {
  storeId: string;
  status: string;
  until: string | null;
}) {
  const [state, formAction] = useActionState(setSubscription, emptyFormState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="storeId" value={storeId} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Assinatura
        </span>
        <select
          name="status"
          defaultValue={status}
          className={`${inputClass} w-36 py-2 text-sm`}
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Vence em
        </span>
        <input
          type="date"
          name="until"
          defaultValue={until ?? ""}
          className={`${inputClass} w-40 py-2 text-sm`}
        />
      </label>

      <Submit label="Salvar" />

      {state.savedAt && !state.error ? (
        <span className="pb-2.5 text-sm text-green-700 dark:text-green-400">
          salvo
        </span>
      ) : null}
      {state.error ? <FormError message={state.error} /> : null}
    </form>
  );
}

/**
 * Mostra a senha nova uma vez só. Não existe "esqueci minha senha" no MVP: o
 * lojista liga e o admin gera outra na hora.
 */
export function ResetPassword({ managerId }: { managerId: string }) {
  const [state, formAction] = useActionState<NewStoreState, FormData>(
    resetManagerPassword,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="managerId" value={managerId} />
      <button
        type="submit"
        className="text-xs text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        gerar nova senha
      </button>

      {state.created ? (
        <code className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {state.created.password}
        </code>
      ) : null}
      {state.error ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
