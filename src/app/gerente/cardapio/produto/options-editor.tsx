import { Card } from "@/components/ui";
import { formatCents } from "@/lib/money";

import {
  deleteOption,
  deleteOptionGroup,
  setOptionAvailability,
} from "../actions";
import { AvailabilityToggle } from "../availability-toggle";
import {
  NewOptionForm,
  NewOptionGroupForm,
  OptionGroupRuleForm,
} from "./option-forms";

type Option = {
  id: string;
  name: string;
  price_delta_cents: number;
  is_available: boolean;
};

type Group = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  options: Option[];
};

/** A mesma regra que o cliente vê no cardápio, dita para o lojista. */
function ruleLabel(group: Group): string {
  const required = group.min_select >= 1 ? "obrigatório" : "opcional";

  return group.max_select === 1
    ? `${required}, escolhe só uma`
    : `${required}, marca até ${group.max_select}`;
}

function priceLabel(cents: number): string {
  if (cents === 0) return "sem acréscimo";
  return `${cents > 0 ? "+" : "−"} ${formatCents(Math.abs(cents))}`;
}

export function OptionsEditor({
  productId,
  groups,
}: {
  productId: string;
  groups: Group[];
}) {
  return (
    <section className="flex max-w-lg flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Opções do item</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Tamanho, adicionais, o que o cliente pode tirar. Aparecem na tela do
          item e entram na mensagem do pedido.
        </p>
      </div>

      {groups.map((group) => (
        <Card key={group.id}>
          <div className="flex items-start gap-3 px-4 py-3">
            <OptionGroupRuleForm
              group={group}
              productId={productId}
              ruleLabel={ruleLabel(group)}
            />

            <form action={deleteOptionGroup}>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="productId" value={productId} />
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                apagar grupo
              </button>
            </form>
          </div>

          {group.options.length > 0 ? (
            <ul>
              {group.options.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center gap-3 border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{option.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {priceLabel(option.price_delta_cents)}
                    </p>
                  </div>

                  <AvailabilityToggle
                    id={option.id}
                    idFieldName="optionId"
                    isAvailable={option.is_available}
                    action={setOptionAvailability}
                    extraFields={{ productId }}
                  />

                  <form action={deleteOption}>
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="productId" value={productId} />
                    <button
                      type="submit"
                      aria-label={`Apagar ${option.name}`}
                      className="rounded-md px-2 py-1 text-sm text-neutral-400 transition hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}

          <NewOptionForm groupId={group.id} productId={productId} />
        </Card>
      ))}

      <NewOptionGroupForm productId={productId} />
    </section>
  );
}
