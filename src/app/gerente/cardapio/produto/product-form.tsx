"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { deleteProduct, saveProduct } from "../actions";
import { ImageUpload } from "./image-upload";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string | null;
  image_url: string | null;
  is_available: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

/** 2490 → "24,90", que é como o lojista digita. */
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductForm({
  storeId,
  categories,
  product,
}: {
  storeId: string;
  categories: { id: string; name: string }[];
  product?: Product;
}) {
  const [state, formAction] = useActionState(saveProduct, emptyFormState);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {product ? (
          <input type="hidden" name="productId" value={product.id} />
        ) : null}

        <Field label="Nome" error={state.fieldErrors?.name}>
          <input
            name="name"
            defaultValue={state.values?.name ?? product?.name}
            required
            maxLength={120}
            autoFocus={!product}
            placeholder="X-Salada"
            className={inputClass}
          />
        </Field>

        <Field
          label="Descrição"
          hint="O que vem no item. É o que convence o cliente a pedir."
          error={state.fieldErrors?.description}
        >
          <textarea
            name="description"
            defaultValue={state.values?.description ?? product?.description ?? ""}
            rows={3}
            maxLength={500}
            placeholder="Pão brioche, hambúrguer 180g, queijo, alface e tomate."
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preço" error={state.fieldErrors?.price}>
            <input
              name="price"
              defaultValue={
                state.values?.price ?? (product ? centsToInput(product.price_cents) : "")
              }
              required
              inputMode="decimal"
              placeholder="24,90"
              className={inputClass}
            />
          </Field>

          <Field label="Categoria" error={state.fieldErrors?.categoryId}>
            <select
              name="categoryId"
              defaultValue={state.values?.categoryId ?? product?.category_id ?? ""}
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ImageUpload
          storeId={storeId}
          name="imageUrl"
          defaultUrl={product?.image_url ?? null}
        />

        <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-3 dark:border-neutral-800">
          <input
            type="checkbox"
            name="isAvailable"
            defaultChecked={product ? product.is_available : true}
            className="size-4"
          />
          <span className="text-sm">
            Disponível para pedido
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Desmarque para deixar o item como esgotado sem apagá-lo.
            </span>
          </span>
        </label>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Submit label={product ? "Salvar" : "Criar item"} />
          <Link href="/gerente/cardapio">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>

      {product ? (
        <form
          action={deleteProduct}
          className="border-t border-neutral-200 pt-6 dark:border-neutral-800"
        >
          <input type="hidden" name="productId" value={product.id} />
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            Apagar remove o item, os grupos de opções e a foto. Se for só uma
            falta temporária, marque como esgotado.
          </p>
          <Button type="submit" variant="danger">
            Apagar item
          </Button>
        </form>
      ) : null}
    </div>
  );
}
