"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { saveOption, saveOptionGroup } from "../actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

/**
 * Estes dois formulários ficam na própria página do produto, então não podem
 * redirecionar — precisam se limpar sozinhos para o lojista cadastrar a
 * próxima opção em seguida. É o que `savedAt` sinaliza.
 */
function useResetOnSave(savedAt: number | undefined) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (savedAt) formRef.current?.reset();
  }, [savedAt]);

  return formRef;
}

export function NewOptionGroupForm({ productId }: { productId: string }) {
  const [state, formAction] = useActionState(saveOptionGroup, emptyFormState);
  const formRef = useResetOnSave(state.savedAt);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700"
    >
      <input type="hidden" name="productId" value={productId} />

      <p className="text-sm font-medium">Novo grupo de opções</p>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Tamanho, Adicionais, Remover…"
            className={inputClass}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.name}
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">mín.</span>
          <input
            name="minSelect"
            type="number"
            min={0}
            max={20}
            defaultValue={0}
            className={`${inputClass} w-20`}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">máx.</span>
          <input
            name="maxSelect"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            className={`${inputClass} w-20`}
          />
        </label>
      </div>

      {state.fieldErrors?.maxSelect ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {state.fieldErrors.maxSelect}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Mínimo 1 torna a escolha obrigatória — é o caso de &ldquo;Tamanho&rdquo;.
        Mínimo 0 deixa opcional, como &ldquo;Adicionais&rdquo;.
      </p>

      <FormError message={state.error} />

      <div>
        <Submit label="Criar grupo" />
      </div>
    </form>
  );
}

export function NewOptionForm({
  groupId,
  productId,
}: {
  groupId: string;
  productId: string;
}) {
  const [state, formAction] = useActionState(saveOption, emptyFormState);
  const formRef = useResetOnSave(state.savedAt);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-start gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="productId" value={productId} />

      <div className="min-w-40 flex-1">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="Bacon"
          className={inputClass}
        />
        {state.fieldErrors?.name ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="w-32">
        <input
          name="priceDelta"
          inputMode="decimal"
          placeholder="+ 5,00"
          className={inputClass}
        />
        {state.fieldErrors?.priceDelta ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.priceDelta}
          </p>
        ) : null}
      </div>

      <Submit label="Adicionar" />

      {state.error ? (
        <div className="w-full">
          <FormError message={state.error} />
        </div>
      ) : null}
    </form>
  );
}
