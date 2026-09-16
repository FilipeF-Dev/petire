"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { MenuPreview } from "@/components/menu-preview";
import { Button, FormError, inputClass } from "@/components/ui";
import { parseMenuInput } from "@/lib/menu-import";
import { PROMPT_DA_IA } from "@/lib/menu-import-prompt";
import { emptyFormState } from "@/lib/validation";

import { importStoreMenu } from "../../actions";

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
 * O formato, pronto para colar numa IA.
 *
 * Sem isto o formato existe só no código, e quem vai usá-lo está no WhatsApp
 * com a foto de um cardápio na mão. Um botão que põe o pedido inteiro na área
 * de transferência é a diferença entre a ferramenta ser usada e ser explicada
 * de novo toda vez.
 */
function FormatoParaIA() {
  const [copiado, setCopiado] = useState(false);

  return (
    <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Formato para pedir à IA
      </summary>

      <div className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Copie, cole numa conversa com a IA e mande junto a foto ou o texto do
          cardápio. A resposta dela cola aqui embaixo.
        </p>

        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(PROMPT_DA_IA);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? "Copiado" : "Copiar o pedido"}
        </Button>

        <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 font-mono text-xs whitespace-pre-wrap">
          {PROMPT_DA_IA}
        </pre>
      </div>
    </details>
  );
}

/**
 * O colar de cardápio do suporte.
 *
 * Mesmo campo e mesma conferência do painel do lojista, com duas diferenças
 * que só existem aqui: ele funciona em **qualquer** loja, sem pedir emprestado
 * o login do dono, e traz o formato para entregar à IA.
 *
 * O campo aceita os dois formatos, como no painel: texto de linhas ou o JSON
 * estruturado, que é o que carrega grupo de opção. A escolha é de quem cola —
 * nenhuma tela a mais para manter.
 */
export function MenuImport({ storeId }: { storeId: string }) {
  const [state, formAction] = useActionState(importStoreMenu, emptyFormState);
  const [text, setText] = useState("");

  const { menu, erro, estruturado } = useMemo(
    () => parseMenuInput(text),
    [text],
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <h2 className="font-medium">Colar cardápio</h2>
        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          Texto simples, ou o JSON estruturado quando o cardápio tiver grupos de
          opção. A importação só adiciona: nada é apagado.
        </p>
      </div>

      <FormatoParaIA />

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="storeId" value={storeId} />

        {/*
          Rótulo de verdade, e não só o `name`: o campo fica dentro de uma
          seção cujo título está fora do formulário, então sem isto ele chega
          sem nome nenhum a quem usa leitor de tela.
        */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Cardápio</span>
          <textarea
            name="menu"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            placeholder={"LANCHES\nX-Salada 24,90\n\nou o JSON do formato acima"}
            className={`${inputClass} font-mono text-sm`}
          />
        </label>

        <FormError message={state.error} />

        {state.savedAt ? (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            Cardápio importado.
          </p>
        ) : null}

        {text.trim() === "" ? null : erro ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {erro}
          </p>
        ) : menu.total === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Nenhum item encontrado. Confira o texto colado.
          </p>
        ) : (
          <>
            {estruturado ? null : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Lido como texto simples — sem grupos de opção. Para trazer os
                grupos, use o formato acima.
              </p>
            )}
            <MenuPreview menu={menu} />
          </>
        )}

        <Submit count={menu.total} />
      </form>
    </section>
  );
}
