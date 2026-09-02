"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { saveStore } from "./actions";

type Store = {
  name: string;
  description: string | null;
  whatsapp_e164: string;
  address: string | null;
  city: string;
  neighborhood: string;
  cuisine_tags: string[];
  kind: "food" | "drinks" | "both";
  delivery_fee_cents: number;
  min_order_cents: number;
};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** 5511987654321 → "(11) 98765-4321", que é como o lojista reconhece o número. */
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
      {pending ? "Salvando…" : "Salvar dados"}
    </Button>
  );
}

export function StoreForm({ store }: { store: Store }) {
  const [state, formAction] = useActionState(saveStore, emptyFormState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Nome da loja" error={state.fieldErrors?.name}>
        <input
          name="name"
          defaultValue={store.name}
          required
          maxLength={120}
          className={inputClass}
        />
      </Field>

      <Field
        label="Descrição"
        hint="Uma linha sobre a loja. Aparece na busca e no topo do cardápio."
        error={state.fieldErrors?.description}
      >
        <textarea
          name="description"
          defaultValue={store.description ?? ""}
          rows={2}
          maxLength={500}
          className={inputClass}
        />
      </Field>

      <Field
        label="WhatsApp"
        hint="É para cá que o pedido do cliente é enviado. Confira com cuidado."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          defaultValue={formatWhatsapp(store.whatsapp_e164)}
          required
          inputMode="tel"
          placeholder="(11) 98765-4321"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bairro" error={state.fieldErrors?.neighborhood}>
          <input
            name="neighborhood"
            defaultValue={store.neighborhood}
            required
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field label="Cidade" error={state.fieldErrors?.city}>
          <input
            name="city"
            defaultValue={store.city}
            required
            maxLength={80}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Endereço" error={state.fieldErrors?.address}>
        <input
          name="address"
          defaultValue={store.address ?? ""}
          maxLength={200}
          placeholder="Rua Aspicuelta, 420"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de loja" error={state.fieldErrors?.kind}>
          <select
            name="kind"
            defaultValue={store.kind}
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
            defaultValue={store.cuisine_tags.join(", ")}
            placeholder="lanches, hamburguer, porcoes"
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
            defaultValue={centsToInput(store.delivery_fee_cents)}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>

        <Field label="Pedido mínimo" error={state.fieldErrors?.minOrder}>
          <input
            name="minOrder"
            defaultValue={centsToInput(store.min_order_cents)}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <FormError message={state.error} />

      {state.savedAt && !state.error ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Dados salvos.
        </p>
      ) : null}

      <div>
        <Submit />
      </div>
    </form>
  );
}
