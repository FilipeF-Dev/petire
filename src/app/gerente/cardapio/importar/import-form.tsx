"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { MenuPreview } from "@/components/menu-preview";
import {
  cabe,
  MenuSpace,
  type EspacoNoCardapio,
} from "@/components/menu-space";
import { Button, FormError, inputClass } from "@/components/ui";
import { parseMenuInput } from "@/lib/menu-import";
import { emptyFormState } from "@/lib/validation";

import { importMenu } from "./actions";

const EXAMPLE = `LANCHES
X-Salada 24,90
X-Bacon 28,90

PORÇÕES
Batata frita 18,90

BEBIDAS
Coca-Cola lata 7,00`;

function Submit({ count, bloqueado }: { count: number; bloqueado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0 || bloqueado}>
      {pending
        ? "Importando…"
        : bloqueado
          ? "Não cabe no plano"
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
export function ImportForm({ espaco }: { espaco: EspacoNoCardapio }) {
  const [state, formAction] = useActionState(importMenu, emptyFormState);
  const [text, setText] = useState(state.values?.menu ?? "");

  const { menu, erro } = useMemo(() => parseMenuInput(text), [text]);

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

      <MenuSpace espaco={espaco} entrando={menu.total} />

      <FormError message={state.error} />

      {text.trim() === "" ? null : erro ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {erro}
        </p>
      ) : menu.total === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma linha tem preço no fim. Confira o texto colado.
        </p>
      ) : (
        <MenuPreview menu={menu} />
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A importação só adiciona: nada do que já está no cardápio é apagado.
        Foto, descrição e opções entram depois, item a item.
      </p>

      <div className="flex gap-2">
        <Submit count={menu.total} bloqueado={!cabe(espaco, menu.total)} />
        <Link href="/gerente/cardapio">
          <Button type="button" variant="secondary">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
