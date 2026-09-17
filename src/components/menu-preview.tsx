import type { ParsedMenu } from "@/lib/menu-import";
import { formatCents } from "@/lib/money";

/**
 * O cardápio lido, antes de virar cardápio.
 *
 * É esta tela que torna aceitável um importador que adivinha: o preço que vai
 * entrar aparece **antes** de gravar, e quando a adivinhação erra quem vê é
 * quem colou, na hora — e não o cliente três dias depois.
 *
 * Mora aqui, e não dentro de um dos formulários, porque tem dois: o lojista
 * cola o cardápio da loja dele, e o suporte do Petire cola o de qualquer loja
 * pelo admin. Duas conferências divergem na primeira correção que só uma
 * receber, e uma conferência errada é pior do que nenhuma — ela dá confiança
 * no que não foi conferido.
 */
export function MenuPreview({ menu }: { menu: ParsedMenu }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
      <p className="text-sm font-medium">
        {menu.total} {menu.total === 1 ? "item" : "itens"} em{" "}
        {menu.sections.length}{" "}
        {menu.sections.length === 1 ? "seção" : "seções"}
      </p>

      {menu.sections.map((section, index) => (
        <div key={`${section.category ?? "sem-secao"}-${index}`}>
          <p className="text-xs font-semibold tracking-wide uppercase">
            {section.category ?? "Sem categoria"}
          </p>

          <ul className="mt-1">
            {section.items.map((item, itemIndex) => (
              <li
                key={`${item.name}-${itemIndex}`}
                className="border-t border-neutral-200 py-1.5 text-sm first:border-t-0 dark:border-neutral-800"
              >
                <div className="flex justify-between gap-4">
                  <span className="min-w-0">{item.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {/*
                      Zero não vira "R$ 0,00" aqui pelo mesmo motivo do
                      cardápio: é o item cujo preço mora numa opção
                      obrigatória, e mostrar zero faria quem colou achar que
                      errou. Ver precoACombinar() em src/lib/menu-price.ts.
                    */}
                    {item.priceCents > 0
                      ? formatCents(item.priceCents)
                      : "a combinar"}
                  </span>
                </div>

                {/*
                  Os grupos aparecem inteiros, com o que cada opção soma. É a
                  parte que mais interessa conferir: errar o preço de um
                  adicional passa despercebido no texto e sai caro em todo
                  pedido que o usar.
                */}
                {item.groups?.map((group, groupIndex) => (
                  <div
                    key={`${group.name}-${groupIndex}`}
                    className="mt-1 ml-3 border-l border-neutral-200 pl-3 dark:border-neutral-800"
                  >
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {group.name}
                      {group.min >= 1 ? " · obrigatório" : " · opcional"}
                      {group.max > 1 ? ` · até ${group.max}` : null}
                    </p>
                    <ul className="text-xs text-neutral-600 dark:text-neutral-400">
                      {group.options.map((option, optionIndex) => (
                        <li
                          key={`${option.name}-${optionIndex}`}
                          className="flex justify-between gap-4"
                        >
                          <span className="min-w-0">{option.name}</span>
                          {option.plusCents > 0 ? (
                            <span className="shrink-0 tabular-nums">
                              +{formatCents(option.plusCents)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {menu.ignored.length > 0 ? (
        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Fora da importação: {menu.ignored.slice(0, 5).join(" · ")}
            {menu.ignored.length > 5
              ? ` e mais ${menu.ignored.length - 5}`
              : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
