"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AddressFields } from "@/components/address-fields";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { siteHost } from "@/lib/site";
import { slugify } from "@/lib/validation";

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
  // O nome alimenta o placeholder do apelido, para quem deixar em branco ver
  // antes de salvar qual link a loja vai ganhar.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

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
            A loja entra <strong>fora do ar</strong>. O endereço dela vai ser{" "}
            <code className="rounded bg-white px-1.5 py-0.5 dark:bg-neutral-900">
              /loja/{state.created.slug}
            </code>
            , mas essa página só responde depois que você colocar no ar — o que
            faz sentido fazer quando o cardápio estiver montado.
          </p>
        </div>

        <div>
          <Link href="/admin">
            <Button>Voltar para a lista</Button>
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
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          autoFocus
          placeholder="Lanchonete do Zé"
          className={inputClass}
        />
      </Field>

      <Field
        label="Apelido da loja no Petire"
        hint="Não é o site da loja. É o pedaço final do link dentro do Petire. Deixe em branco para gerar a partir do nome."
        error={state.fieldErrors?.slug}
      >
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 focus-within:border-neutral-900 dark:border-neutral-700 dark:focus-within:border-neutral-300">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            {siteHost}/loja/
          </span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            maxLength={60}
            placeholder={slugify(name) || "lanchonete-do-ze"}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
          />
        </div>
      </Field>

      <AddressFields errors={state.fieldErrors} />

      <Field
        label="WhatsApp da loja"
        hint="É para cá que os pedidos vão."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          defaultValue={state.values?.whatsapp ?? ""}
          required
          inputMode="tel"
          placeholder="(11) 98765-4321"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de loja" error={state.fieldErrors?.kind}>
          <select
            name="kind"
            defaultValue={state.values?.kind ?? "food"}
            className={inputClass}
          >
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
            defaultValue={state.values?.trialDays ?? 90}
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
          defaultValue={state.values?.managerEmail ?? ""}
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
