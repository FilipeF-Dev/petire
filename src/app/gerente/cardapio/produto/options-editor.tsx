import { Card } from "@/components/ui";
import { formatCents } from "@/lib/money";

import {
  deleteOption,
  detachOptionGroup,
  setOptionAvailability,
} from "../actions";
import { AvailabilityToggle } from "../availability-toggle";
import {
  NewOptionForm,
  NewOptionGroupForm,
  OptionGroupRuleForm,
  ReuseOptionGroupForm,
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
  /** Em quantos itens do cardápio este grupo está. */
  usedBy: number;
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
  reusable,
}: {
  productId: string;
  groups: Group[];
  reusable: { id: string; name: string; usedBy: number }[];
}) {
  return (
    <section className="flex max-w-lg flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Opções do item</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Tamanho, adicionais, o que dá para tirar. Um grupo pode servir vários
          itens — crie uma vez e use onde precisar.
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

            {/*
              "Tirar deste item", e não "apagar", quando o grupo está em outros:
              apagá-lo de dentro de um item mexeria no cardápio inteiro por um
              botão que não avisou. Quando este é o único item que o usa, ele
              some junto — ver detachOptionGroup.
            */}
            <form action={detachOptionGroup}>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="productId" value={productId} />
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-xs whitespace-nowrap text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                {group.usedBy > 1 ? "tirar deste item" : "apagar grupo"}
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

      <ReuseOptionGroupForm productId={productId} groups={reusable} />

      <NewOptionGroupForm productId={productId} />
    </section>
  );
}
