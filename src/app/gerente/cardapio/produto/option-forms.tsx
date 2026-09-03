"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, FormError, inputClass } from "@/components/ui";
import { emptyFormState, type FormState } from "@/lib/validation";

import { saveOption, saveOptionGroup } from "../actions";

export type GroupRule = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

/**
 * Estes formulários ficam na própria página do produto, então não podem
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

function choiceClass(active: boolean) {
  return `flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition ${
    active
      ? "border-neutral-900 dark:border-neutral-200"
      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
  }`;
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 dark:text-red-400">{message}</p>;
}

/**
 * A regra do grupo, na linguagem de quem está atrás do balcão.
 *
 * O banco guarda min_select/max_select, mas a pergunta que o lojista responde
 * é outra: o cliente marca **uma** opção ou **várias**? Dois campos numéricos
 * convidavam ao erro que só aparece quando o pedido chega — uma batata pedida
 * pequena e grande ao mesmo tempo.
 */
function GroupRuleFields({ group }: { group?: GroupRule }) {
  const [selection, setSelection] = useState<"single" | "multiple">(
    group && group.max_select > 1 ? "multiple" : "single",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={choiceClass(selection === "single")}>
          <input
            type="radio"
            name="selection"
            value="single"
            checked={selection === "single"}
            onChange={() => setSelection("single")}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">
            <span className="font-medium">Só uma opção</span>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Tamanho: ou é pequena, ou é grande.
            </span>
          </span>
        </label>

        <label className={choiceClass(selection === "multiple")}>
          <input
            type="radio"
            name="selection"
            value="multiple"
            checked={selection === "multiple"}
            onChange={() => setSelection("multiple")}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">
            <span className="font-medium">Pode marcar várias</span>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Adicionais: bacon, cheddar, ovo.
            </span>
          </span>
        </label>
      </div>

      {selection === "multiple" ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">
            No máximo
          </span>
          <input
            name="maxSelect"
            type="number"
            min={2}
            max={20}
            defaultValue={group && group.max_select > 1 ? group.max_select : 3}
            className={`${inputClass} w-20`}
          />
          <span className="text-neutral-500 dark:text-neutral-400">opções</span>
        </label>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isRequired"
          defaultChecked={(group?.min_select ?? 0) >= 1}
          className="mt-0.5 size-4"
        />
        <span>
          Obrigatório
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            O cliente não adiciona o item sem escolher.
          </span>
        </span>
      </label>
    </div>
  );
}

function RuleErrors({ state }: { state: FormState }) {
  return (
    <>
      <FieldError message={state.fieldErrors?.selection} />
      <FieldError message={state.fieldErrors?.maxSelect} />
      <FormError message={state.error} />
    </>
  );
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

      <div>
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={state.values?.name}
          placeholder="Tamanho, Adicionais, Remover…"
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>

      <GroupRuleFields />

      <RuleErrors state={state} />

      <div>
        <Submit label="Criar grupo" />
      </div>
    </form>
  );
}

/**
 * A regra de um grupo que já existe.
 *
 * Sem poder editar, corrigir um "Tamanho" cadastrado como múltipla escolha
 * exigiria apagar o grupo — e junto iriam todas as opções já digitadas.
 */
export function OptionGroupRuleForm({
  group,
  productId,
  ruleLabel,
}: {
  group: GroupRule;
  productId: string;
  ruleLabel: string;
}) {
  const [state, formAction] = useActionState(saveOptionGroup, emptyFormState);

  // O formulário se fecha quando a gravação passa. Guardar o `savedAt` de
  // quando ele abriu deixa o próprio render responder isso — um efeito com
  // setState renderizaria duas vezes para chegar ao mesmo lugar.
  const [openedAt, setOpenedAt] = useState<{ savedAt: number | null } | null>(
    null,
  );
  const isEditing =
    openedAt !== null && openedAt.savedAt === (state.savedAt ?? null);

  if (!isEditing) {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{group.name}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {ruleLabel}
          {" · "}
          <button
            type="button"
            onClick={() => setOpenedAt({ savedAt: state.savedAt ?? null })}
            className="underline underline-offset-2"
          >
            editar
          </button>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-3">
      <input type="hidden" name="groupId" value={group.id} />
      <input type="hidden" name="productId" value={productId} />

      <div>
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={state.values?.name ?? group.name}
          className={inputClass}
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>

      <GroupRuleFields group={group} />

      <RuleErrors state={state} />

      <div className="flex items-center gap-2">
        <Submit label="Salvar" />
        <button
          type="button"
          onClick={() => setOpenedAt(null)}
          className="text-sm text-neutral-500 dark:text-neutral-400"
        >
          cancelar
        </button>
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
