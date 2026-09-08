"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { addProspect } from "./actions";

/**
 * A anotação da calçada.
 *
 * O formulário é usado em pé, na rua, entre uma porta e a seguinte. Por isso
 * ele é curto e por isso o que se repete não se redigita: bairro e cidade
 * seguem preenchidos da última anotação, e só o nome e as três marcas voltam
 * ao zero. Uma tarde de levantamento são quinze anotações — redigitar
 * "Benfica" quinze vezes é onde alguém desiste e volta para o papel.
 */

const MARKS = [
  {
    name: "has_menu",
    label: "Cardápio à vista",
    hint: "Impresso, adesivado, na vitrine",
  },
  {
    name: "has_whatsapp",
    label: "WhatsApp na fachada",
    hint: "O sinal de que ela já vende por lá",
  },
  {
    name: "on_app",
    label: "Está em aplicativo",
    hint: "Confira ali mesmo, no celular",
  },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Anotando…" : "Anotar loja"}
    </Button>
  );
}

export function ProspectForm({
  city,
  neighborhood,
}: {
  city: string;
  neighborhood: string;
}) {
  const [state, formAction] = useActionState(addProspect, emptyFormState);
  const nameRef = useRef<HTMLInputElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.savedAt) return;

    // Limpar o formulário inteiro apagaria o bairro, que é o mesmo a tarde
    // toda. Só o que muda de porta para porta volta ao zero, e o foco volta
    // para o nome — que é sempre o próximo campo a receber alguma coisa.
    if (nameRef.current) {
      nameRef.current.value = "";
      nameRef.current.focus();
    }

    const marks =
      marksRef.current?.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      ) ?? [];
    for (const mark of marks) mark.checked = false;
  }, [state.savedAt]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nome da loja" error={state.fieldErrors?.name}>
        <input
          ref={nameRef}
          name="name"
          maxLength={80}
          placeholder="Como está na fachada"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bairro" error={state.fieldErrors?.neighborhood}>
          <input
            name="neighborhood"
            defaultValue={neighborhood}
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field label="Cidade" error={state.fieldErrors?.city}>
          <input
            name="city"
            defaultValue={city}
            maxLength={80}
            className={inputClass}
          />
        </Field>
      </div>

      <div ref={marksRef} className="flex flex-col gap-2">
        <span className="text-sm font-medium">O que dá para ver da calçada</span>
        {MARKS.map((mark) => (
          <label
            key={mark.name}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 transition hover:bg-surface-hover dark:border-neutral-800"
          >
            <input
              type="checkbox"
              name={mark.name}
              className="mt-0.5 size-5 shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-sm">{mark.label}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {mark.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      <FormError message={state.error} />

      <div>
        <Submit />
      </div>
    </form>
  );
}
