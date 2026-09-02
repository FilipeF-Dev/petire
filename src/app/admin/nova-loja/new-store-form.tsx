"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";

import { createStore, type NewStoreState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando…" : "Criar loja"}
    </Button>
  );
}

export function NewStoreForm() {
  const [state, formAction] = useActionState<NewStoreState, FormData>(
    createStore,
    { error: null },
  );

  if (state.created) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="rounded-xl border border-green-300 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-900 dark:text-green-200">
            Loja criada.
          </p>
          <p className="mt-1 text-sm text-green-800 dark:text-green-300">
            Anote as credenciais agora — a senha não aparece de novo.
          </p>

          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-green-800 dark:text-green-400">E-mail</dt>
              <dd>
                <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                  {state.created.email}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-green-800 dark:text-green-400">Senha</dt>
              <dd>
                <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                  {state.created.password}
                </code>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-green-800 dark:text-green-300">
            A loja entra fora do ar. Coloque no ar depois que o lojista montar o
            cardápio.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin">
            <Button>Voltar para a lista</Button>
          </Link>
          <Link href={`/loja/${state.created.slug}`}>
            <Button variant="secondary">Ver a página da loja</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Nome da loja" error={state.fieldErrors?.name}>
        <input
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder="Lanchonete do Zé"
          className={inputClass}
        />
      </Field>

      <Field
        label="Endereço na web"
        hint="Deixe em branco para gerar a partir do nome. Depois de publicado, mudar isto quebra os links já indexados."
        error={state.fieldErrors?.slug}
      >
        <input
          name="slug"
          maxLength={60}
          placeholder="lanchonete-do-ze"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bairro" error={state.fieldErrors?.neighborhood}>
          <input
            name="neighborhood"
            required
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field label="Cidade" error={state.fieldErrors?.city}>
          <input name="city" required maxLength={80} className={inputClass} />
        </Field>
      </div>

      <Field
        label="WhatsApp da loja"
        hint="É para cá que os pedidos vão."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          required
          inputMode="tel"
          placeholder="(11) 98765-4321"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de loja" error={state.fieldErrors?.kind}>
          <select name="kind" defaultValue="food" className={inputClass}>
            <option value="food">Comida</option>
            <option value="drinks">Bebidas</option>
            <option value="both">Comida e bebidas</option>
          </select>
        </Field>

        <Field
          label="Dias de teste"
          hint="As primeiras lojas do bairro entram com 90."
          error={state.fieldErrors?.trialDays}
        >
          <input
            name="trialDays"
            type="number"
            min={0}
            max={365}
            defaultValue={90}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="E-mail do lojista"
        hint="Vira o login do painel. A senha inicial é gerada e mostrada uma vez."
        error={state.fieldErrors?.managerEmail}
      >
        <input
          name="managerEmail"
          type="email"
          required
          placeholder="dono@lanchonete.com.br"
          className={inputClass}
        />
      </Field>

      <FormError message={state.error} />

      <div className="flex gap-2">
        <Submit />
        <Link href="/admin">
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
