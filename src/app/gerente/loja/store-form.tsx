"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AddressFields } from "@/components/address-fields";
import { CuisinePicker } from "@/components/cuisine-picker";
import { ImageUpload } from "@/components/image-upload";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { saveStore } from "./actions";

type Store = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  whatsapp_e164: string;
  address: string | null;
  cep: string | null;
  state_uf: string | null;
  ibge_code: string | null;
  city: string;
  neighborhood: string;
  cuisine_tags: string[];
  kind: "food" | "drinks" | "both";
  delivery_fee_cents: number;
  free_delivery: boolean;
  delivery_minutes: number | null;
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
          defaultValue={state.values?.name ?? store.name}
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
          defaultValue={state.values?.description ?? store.description ?? ""}
          rows={2}
          maxLength={500}
          className={inputClass}
        />
      </Field>

      {/*
        Logo e capa logo depois do nome e da descrição: as quatro coisas são a
        mesma pergunta — quem é esta loja — e é o bloco que o cliente vê antes
        de qualquer preço. A logo tem peso maior porque é ela que aparece na
        lista; a capa só existe dentro da página da loja.
      */}
      <ImageUpload
        storeId={store.id}
        name="logoUrl"
        defaultUrl={store.logo_url}
        label="Logo"
        folder="loja"
        hint="Quadrada, com a marca no centro. É ela que aparece na lista de lojas — sem ela, a loja entra como a primeira letra do nome."
      />

      <ImageUpload
        storeId={store.id}
        name="coverUrl"
        defaultUrl={store.cover_url}
        label="Capa"
        folder="loja"
        aspect="wide"
        hint="A faixa larga no topo da página da loja. Ela é cortada em 3 por 1 — o que estiver nas beiradas some."
      />

      <Field
        label="WhatsApp"
        hint="É para cá que o pedido do cliente é enviado. Confira com cuidado."
        error={state.fieldErrors?.whatsapp}
      >
        <input
          name="whatsapp"
          defaultValue={
            state.values?.whatsapp ?? formatWhatsapp(store.whatsapp_e164)
          }
          required
          inputMode="tel"
          placeholder="(11) 98765-4321"
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

        <Field label="Tipo de culinária" error={state.fieldErrors?.cuisineTags}>
          <CuisinePicker
            name="cuisineTags"
            ariaLabel="Tipo de culinária"
            defaultValue={
              state.values?.cuisineTags ?? store.cuisine_tags.join(", ")
            }
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field
            label="Taxa de entrega"
            hint="Em branco ou 0 aparece como “a combinar”."
            error={state.fieldErrors?.deliveryFee}
          >
            <input
              name="deliveryFee"
              defaultValue={
                state.values?.deliveryFee ??
                centsToInput(store.delivery_fee_cents)
              }
              inputMode="decimal"
              className={inputClass}
            />
          </Field>

          {/*
            Marcar é diferente de deixar a taxa em zero. Zero é "não informei",
            e é assim que a maioria das lojas nasce; grátis é uma promessa, e o
            cliente filtra por ela na lista.
          */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="freeDelivery"
              defaultChecked={store.free_delivery}
              className="mt-0.5 size-4"
            />
            <span>
              Entrego de graça
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                Aparece como “entrega grátis” e entra no filtro da lista.
              </span>
            </span>
          </label>
        </div>

        <Field
          label="Tempo médio de entrega"
          hint="Em minutos, depois que você confirma o pedido. Em branco não mostra nada."
          error={state.fieldErrors?.deliveryMinutes}
        >
          <input
            name="deliveryMinutes"
            inputMode="numeric"
            placeholder="40"
            defaultValue={
              state.values?.deliveryMinutes ??
              (store.delivery_minutes === null
                ? ""
                : String(store.delivery_minutes))
            }
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
          Dados salvos.
        </p>
      ) : null}

      <div>
        <Submit />
      </div>
    </form>
  );
}
