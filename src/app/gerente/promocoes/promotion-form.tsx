"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { endsAtToDay, startsAtToDay } from "@/lib/promotions";
import { emptyFormState } from "@/lib/validation";

import { deletePromotion, savePromotion } from "./actions";

export type EditablePromotion = {
  id: string;
  product_id: string | null;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string;
  ends_at: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

function kindClass(active: boolean) {
  return `flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
    active
      ? "border-neutral-900 dark:border-neutral-200"
      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
  }`;
}

/** 500 → "5,00"; 10 → "10". O valor é lido conforme o tipo do desconto. */
function valueToInput(promotion: EditablePromotion): string {
  return promotion.kind === "percent"
    ? String(promotion.value)
    : (promotion.value / 100).toFixed(2).replace(".", ",");
}

export function PromotionForm({
  products,
  promotion,
}: {
  products: { id: string; name: string }[];
  promotion?: EditablePromotion;
}) {
  const [state, formAction] = useActionState(savePromotion, emptyFormState);
  const [kind, setKind] = useState<"percent" | "fixed">(
    promotion?.kind ?? "percent",
  );

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {promotion ? (
          <input type="hidden" name="promotionId" value={promotion.id} />
        ) : null}

        <Field
          label="O desconto vale para"
          hint="Promoção de item ganha da promoção do cardápio inteiro — elas não somam."
          error={state.fieldErrors?.productId}
        >
          <select
            name="productId"
            defaultValue={
              state.values?.productId ?? promotion?.product_id ?? ""
            }
            className={inputClass}
          >
            <option value="">Todo o cardápio</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tipo de desconto</span>
          <div className="flex gap-2">
            <label className={kindClass(kind === "percent")}>
              <input
                type="radio"
                name="kind"
                value="percent"
                checked={kind === "percent"}
                onChange={() => setKind("percent")}
                className="size-4"
              />
              Porcentagem
            </label>
            <label className={kindClass(kind === "fixed")}>
              <input
                type="radio"
                name="kind"
                value="fixed"
                checked={kind === "fixed"}
                onChange={() => setKind("fixed")}
                className="size-4"
              />
              Valor fixo
            </label>
          </div>
        </div>

        <Field
          label={kind === "percent" ? "Quanto de desconto" : "Quanto abater"}
          hint={
            kind === "percent"
              ? "De 1% a 100% do preço do item."
              : "Sai do preço de cada item, não do total do pedido."
          }
          error={state.fieldErrors?.value}
        >
          <input
            name="value"
            required
            inputMode="decimal"
            defaultValue={
              state.values?.value ?? (promotion ? valueToInput(promotion) : "")
            }
            placeholder={kind === "percent" ? "10" : "5,00"}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Começa em"
            hint="Em branco: vale já."
            error={state.fieldErrors?.startsOn}
          >
            <input
              name="startsOn"
              type="date"
              defaultValue={
                state.values?.startsOn ??
                (promotion ? startsAtToDay(promotion.starts_at) : "")
              }
              className={inputClass}
            />
          </Field>

          <Field
            label="Termina em"
            hint="Em branco: sem prazo."
            error={state.fieldErrors?.endsOn}
          >
            <input
              name="endsOn"
              type="date"
              defaultValue={
                state.values?.endsOn ??
                (promotion ? endsAtToDay(promotion.ends_at) : "")
              }
              className={inputClass}
            />
          </Field>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          O dia final conta inteiro: uma promoção até dia 30 ainda vale no
          jantar do dia 30. Marcada para começar depois, ela pode levar até uma
          hora para aparecer no cardápio.
        </p>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Submit label={promotion ? "Salvar" : "Criar promoção"} />
          <Link href="/gerente/promocoes">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>

      {promotion ? (
        <form
          action={deletePromotion}
          className="border-t border-neutral-200 pt-6 dark:border-neutral-800"
        >
          <input type="hidden" name="promotionId" value={promotion.id} />
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            Se ela volta depois — a promoção de sexta, o combo do fim de mês —
            pause em vez de apagar.
          </p>
          <Button type="submit" variant="danger">
            Apagar promoção
          </Button>
        </form>
      ) : null}
    </div>
  );
}
