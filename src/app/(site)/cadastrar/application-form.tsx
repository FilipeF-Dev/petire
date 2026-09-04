"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AddressFields } from "@/components/address-fields";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { applyForStore } from "./actions";

/**
 * O formulário que o lojista preenche sozinho.
 *
 * Pede o mínimo para o admin conseguir decidir: o que a loja é, onde fica e
 * para onde o pedido vai. Cardápio, logo, taxa e horário ficam para o painel —
 * pedir tudo aqui transformaria a candidatura num formulário que ninguém
 * termina, e nada disso muda a decisão de aprovar.
 *
 * O CEP faz o trabalho pesado, como no resto do site: preenche endereço,
 * bairro, cidade, UF e o código IBGE do município, que é o que agrupa a loja
 * com as vizinhas.
 */

const KINDS = [
  { value: "food", label: "Comida" },
  { value: "drinks", label: "Bebida" },
  { value: "both", label: "Comida e bebida" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Quero cadastrar minha loja"}
    </Button>
  );
}

export function ApplicationForm() {
  const [state, formAction] = useActionState(applyForStore, emptyFormState);

  if (state.savedAt && !state.error) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950">
        <p className="font-medium text-green-900 dark:text-green-200">
          Recebemos seu cadastro.
        </p>
        <p className="mt-1 text-sm text-green-800 dark:text-green-300">
          A gente confere os dados e manda o acesso do painel no WhatsApp que
          você informou. Sua loja entra no ar depois que o cardápio estiver de
          pé — loja vazia no catálogo não ajuda ninguém.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-green-900 underline underline-offset-4 dark:text-green-200"
        >
          Voltar para o início
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nome da loja" error={state.fieldErrors?.storeName}>
        <input
          name="storeName"
          defaultValue={state.values?.storeName ?? ""}
          maxLength={80}
          placeholder="Como está na fachada"
          className={inputClass}
        />
      </Field>

      <Field
        label="WhatsApp que recebe pedido"
        hint="É para onde o pedido vai chegar. Se for outro número, o pedido se perde."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          defaultValue={state.values?.whatsapp ?? ""}
          inputMode="tel"
          placeholder="(11) 98765-4321"
          className={inputClass}
        />
      </Field>

      <AddressFields errors={state.fieldErrors} />

      <Field label="O que a loja vende" error={state.fieldErrors?.kind}>
        <select
          name="kind"
          defaultValue={state.values?.kind ?? "food"}
          className={inputClass}
        >
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="E-mail do dono"
        hint="Vira o login do painel."
        error={state.fieldErrors?.managerEmail}
      >
        <input
          name="managerEmail"
          type="email"
          defaultValue={state.values?.managerEmail ?? ""}
          className={inputClass}
        />
      </Field>

      <Field
        label="Quer contar mais alguma coisa? (opcional)"
        error={state.fieldErrors?.note}
      >
        <textarea
          name="note"
          defaultValue={state.values?.note ?? ""}
          maxLength={500}
          rows={3}
          placeholder="Horário, tipo de comida, se o cardápio está em foto…"
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Submit />
      </div>

      <FormError message={state.error} />
    </form>
  );
}
