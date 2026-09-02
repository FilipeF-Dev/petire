"use client";

import { useOptimistic, useTransition } from "react";

/**
 * "Esgotado" em um toque.
 *
 * É a ação mais frequente do painel e acontece no meio do movimento, então o
 * botão responde na hora (useOptimistic) e a ida ao servidor fica por baixo.
 * Se a gravação falhar, o React reverte sozinho ao estado do servidor.
 */
export function AvailabilityToggle({
  id,
  idFieldName,
  isAvailable,
  action,
  extraFields,
}: {
  id: string;
  idFieldName: "productId" | "optionId";
  isAvailable: boolean;
  action: (formData: FormData) => Promise<void>;
  extraFields?: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(isAvailable);

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      disabled={isPending}
      onClick={() => {
        const next = !optimistic;
        const formData = new FormData();
        formData.set(idFieldName, id);
        formData.set("isAvailable", String(next));
        for (const [key, value] of Object.entries(extraFields ?? {})) {
          formData.set(key, value);
        }

        startTransition(async () => {
          setOptimistic(next);
          await action(formData);
        });
      }}
      className={
        optimistic
          ? "shrink-0 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 transition dark:border-green-900 dark:bg-green-950 dark:text-green-300"
          : "shrink-0 rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-500 transition dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
      }
    >
      {optimistic ? "Disponível" : "Esgotado"}
    </button>
  );
}
