"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { deleteCategory, saveCategory } from "../actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

export function CategoryForm({
  category,
}: {
  category?: { id: string; name: string };
}) {
  const [state, formAction] = useActionState(saveCategory, emptyFormState);

  return (
    <div className="flex max-w-md flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {category ? (
          <input type="hidden" name="categoryId" value={category.id} />
        ) : null}

        <Field label="Nome da categoria" error={state.fieldErrors?.name}>
          <input
            name="name"
            defaultValue={category?.name}
            required
            maxLength={60}
            autoFocus={!category}
            placeholder="Lanches"
            className={inputClass}
          />
        </Field>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Submit label={category ? "Salvar" : "Criar categoria"} />
          <Link href="/gerente/cardapio">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>

      {category ? (
        <form action={deleteCategory} className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <input type="hidden" name="categoryId" value={category.id} />
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            Apagar a categoria não apaga os itens: eles passam para
            &ldquo;Sem categoria&rdquo; e continuam no ar.
          </p>
          <Button type="submit" variant="danger">
            Apagar categoria
          </Button>
        </form>
      ) : null}
    </div>
  );
}
