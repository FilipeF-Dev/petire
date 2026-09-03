"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AddressFields } from "@/components/address-fields";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { siteHost } from "@/lib/site";
import { emptyFormState } from "@/lib/validation";

import { updateStore } from "../../actions";

type Store = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  whatsapp_e164: string;
  cep: string | null;
  address: string | null;
  city: string;
  neighborhood: string;
  state_uf: string | null;
  ibge_code: string | null;
  cuisine_tags: string[];
  kind: "food" | "drinks" | "both";
  delivery_fee_cents: number;
  min_order_cents: number;
  is_active: boolean;
};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatWhatsapp(e164: string): string {
  const national = e164.startsWith("55") ? e164.slice(2) : e164;
  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return e164;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar loja"}
    </Button>
  );
}

export function EditStoreForm({ store }: { store: Store }) {
  const [state, formAction] = useActionState(updateStore, emptyFormState);
  const [slug, setSlug] = useState(state.values?.slug ?? store.slug);

  const slugChanged = slug.trim() !== store.slug;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="storeId" value={store.id} />

      <Field label="Nome da loja" error={state.fieldErrors?.name}>
        <input
          name="name"
          defaultValue={state.values?.name ?? store.name}
          required
          maxLength={120}
          className={inputClass}
        />
      </Field>

      <Field
        label="Apelido da loja no Petire"
        hint="Não é o site da loja. É o pedaço final do link dentro do Petire."
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
            required
            maxLength={60}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
          />
        </div>
      </Field>

      {slugChanged ? (
        <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {store.is_active
            ? "Esta loja está no ar. O apelido antigo continua funcionando e passa a redirecionar para o novo, então links salvos e o que o Google indexou não quebram."
            : "O apelido antigo passa a redirecionar para o novo."}
        </p>
      ) : null}

      <Field
        label="Descrição"
        hint="Uma linha sobre a loja. Aparece na busca e no topo do cardápio."
        error={state.fieldErrors?.description}
      >
        <textarea
          name="description"
          defaultValue={state.values?.description ?? store.description ?? ""}
          rows={2}
          maxLength={500}
          className={inputClass}
        />
      </Field>

      <Field
        label="WhatsApp da loja"
        hint="É para cá que os pedidos vão."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          defaultValue={
            state.values?.whatsapp ?? formatWhatsapp(store.whatsapp_e164)
          }
          required
          inputMode="tel"
          className={inputClass}
        />
      </Field>

      <AddressFields
        initial={{
          cep: store.cep ?? "",
          address: store.address ?? "",
          neighborhood: store.neighborhood,
          city: store.city,
          uf: store.state_uf ?? "",
          ibge: store.ibge_code ?? "",
        }}
        errors={state.fieldErrors}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de loja" error={state.fieldErrors?.kind}>
          <select
            name="kind"
            defaultValue={state.values?.kind ?? store.kind}
            className={inputClass}
          >
            <option value="food">Comida</option>
            <option value="drinks">Bebidas</option>
            <option value="both">Comida e bebidas</option>
          </select>
        </Field>

        <Field
          label="Tags"
          hint="Separadas por vírgula. Servem para o cliente filtrar."
          error={state.fieldErrors?.cuisineTags}
        >
          <input
            name="cuisineTags"
            defaultValue={
              state.values?.cuisineTags ?? store.cuisine_tags.join(", ")
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Taxa de entrega"
          hint="0 se for grátis ou combinada na hora."
          error={state.fieldErrors?.deliveryFee}
        >
          <input
            name="deliveryFee"
            defaultValue={
              state.values?.deliveryFee ?? centsToInput(store.delivery_fee_cents)
            }
            inputMode="decimal"
            className={inputClass}
          />
        </Field>

        <Field label="Pedido mínimo" error={state.fieldErrors?.minOrder}>
          <input
            name="minOrder"
            defaultValue={
              state.values?.minOrder ?? centsToInput(store.min_order_cents)
            }
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <FormError message={state.error} />

      {state.savedAt && !state.error ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Loja salva.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit />
        <Link href="/admin">
          <Button type="button" variant="secondary">
            Voltar
          </Button>
        </Link>
      </div>
    </form>
  );
}
