"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, FormError, inputClass } from "@/components/ui";
import { parseMenu } from "@/lib/menu-import";
import { formatCents } from "@/lib/money";
import { emptyFormState } from "@/lib/validation";

import { importMenu } from "./actions";

const EXAMPLE = `LANCHES
X-Salada 24,90
X-Bacon 28,90

PORÇÕES
Batata frita 18,90

BEBIDAS
Coca-Cola lata 7,00`;

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? "Importando…"
        : `Importar ${count} ${count === 1 ? "item" : "itens"}`}
    </Button>
  );
}

/**
 * Colar o cardápio, conferir, importar.
 *
 * A conferência roda no browser, com a mesma função que a Server Action usa
 * para gravar. O lojista vê o preço que vai entrar **antes** de gravar, e é
 * isso que torna aceitável adivinhar o formato do texto: quando a adivinhação
 * erra, ele vê na hora, e não o cliente três dias depois.
 */
export function ImportForm() {
  const [state, formAction] = useActionState(importMenu, emptyFormState);
  const [text, setText] = useState(state.values?.menu ?? "");

  const menu = useMemo(() => parseMenu(text), [text]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Cole o cardápio aqui</span>
        <textarea
          name="menu"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          autoFocus
          placeholder={EXAMPLE}
          className={`${inputClass} font-mono text-sm`}
        />
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Um item por linha, com o preço no fim. Linha sem preço vira o nome de
          uma seção.
        </span>
      </label>

      <FormError message={state.error} />

      {text.trim() === "" ? null : menu.total === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma linha tem preço no fim. Confira o texto colado.
        </p>
      ) : (
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
                    className="flex justify-between gap-4 border-t border-neutral-200 py-1.5 text-sm first:border-t-0 dark:border-neutral-800"
                  >
                    <span className="min-w-0">{item.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatCents(item.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {menu.ignored.length > 0 ? (
            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Fora da importação, por não ter preço:{" "}
                {menu.ignored.slice(0, 5).join(" · ")}
                {menu.ignored.length > 5
                  ? ` e mais ${menu.ignored.length - 5}`
                  : null}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A importação só adiciona: nada do que já está no cardápio é apagado.
        Foto, descrição e opções entram depois, item a item.
      </p>

      <div className="flex gap-2">
        <Submit count={menu.total} />
        <Link href="/gerente/cardapio">
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
