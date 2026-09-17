"use client";

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
import { PROMPT_DA_IA } from "@/lib/menu-import-prompt";
import { emptyFormState } from "@/lib/validation";

import { importStoreMenu } from "../../actions";

/**
 * O botão diz o que vai fazer, e o rótulo não mente sobre o motivo de estar
 * travado.
 *
 * São dois motivos diferentes, e confundi-los custou um teste: "não cabe no
 * plano" é uma coisa, "falta digitar o apelido" é outra — e quem lê o primeiro
 * quando o problema é o segundo vai procurar erro no lugar errado. Faltando a
 * confirmação, o rótulo continua dizendo o que o botão faria, porque a
 * explicação está no campo logo acima dele.
 */
function Submit({
  count,
  substituindo,
  naoCabe,
  faltaConfirmar,
}: {
  count: number;
  substituindo: boolean;
  naoCabe: boolean;
  faltaConfirmar: boolean;
}) {
  const { pending } = useFormStatus();
  const quantos = `${count} ${count === 1 ? "item" : "itens"}`;
  // "Substituir pelos 1 item" não é português. O artigo concorda com a conta.
  const pelo = count === 1 ? "pelo" : "pelos";

  return (
    <Button
      type="submit"
      disabled={pending || count === 0 || naoCabe || faltaConfirmar}
    >
      {pending
        ? "Importando…"
        : naoCabe
          ? "Não cabe no plano"
          : substituindo
            ? `Substituir ${pelo} ${quantos}`
            : `Importar ${quantos}`}
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
/**
 * Apagar o que está lá antes de colar.
 *
 * Fricção deliberada, no mesmo formato da exclusão de loja: o campo só libera
 * quando o apelido é digitado exatamente. O risco aqui não é o clique
 * distraído no botão — é o clique na **loja errada**, com meia dúzia de abas
 * abertas. Digitar o apelido é justamente o que defende disso.
 */
function Substituir({
  slug,
  espaco,
  marcado,
  onMarcar,
  confirmacao,
  onConfirmar,
}: {
  slug: string;
  espaco: EspacoNoCardapio;
  marcado: boolean;
  onMarcar: (valor: boolean) => void;
  confirmacao: string;
  onConfirmar: (valor: string) => void;
}) {
  if (espaco.usados === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="substituir"
          checked={marcado}
          onChange={(event) => onMarcar(event.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          Substituir o cardápio atual
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            Apaga os {espaco.usados} itens que já estão lá, com as categorias,
            os grupos de opção e as promoções deles. Os números de acesso da
            loja não são afetados.
          </span>
        </span>
      </label>

      {marcado ? (
        <label className="flex flex-col gap-1.5">
          {/*
            O rótulo diz o que está sendo confirmado, e não só "confirmar".
            A mesma página tem o campo de apagar a loja, com o mesmo apelido no
            rótulo — dois campos idênticos numa tela é confusão para quem lê e
            armadilha para quem usa leitor de tela.
          */}
          <span className="text-sm font-medium">
            Digite {slug} para substituir o cardápio
          </span>
          <input
            name="confirmar"
            value={confirmacao}
            onChange={(event) => onConfirmar(event.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </label>
      ) : null}
    </div>
  );
}

export function MenuImport({
  storeId,
  slug,
  espaco,
}: {
  storeId: string;
  slug: string;
  espaco: EspacoNoCardapio;
}) {
  const [state, formAction] = useActionState(importStoreMenu, emptyFormState);
  const [text, setText] = useState("");
  const [substituir, setSubstituir] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const { menu, erro, estruturado } = useMemo(
    () => parseMenuInput(text),
    [text],
  );

  // Substituindo, a loja fica vazia antes da colagem — então o que cabe é o
  // teto inteiro. Sem isto o botão continuaria bloqueado por itens que estão
  // prestes a deixar de existir.
  const espacoValendo = substituir ? { ...espaco, usados: 0 } : espaco;

  const podeSubstituir = !substituir || confirmacao === slug;

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

        <Substituir
          slug={slug}
          espaco={espaco}
          marcado={substituir}
          onMarcar={setSubstituir}
          confirmacao={confirmacao}
          onConfirmar={setConfirmacao}
        />

        <MenuSpace espaco={espacoValendo} entrando={menu.total} />

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

        <Submit
          count={menu.total}
          substituindo={substituir}
          naoCabe={!cabe(espacoValendo, menu.total)}
          faltaConfirmar={!podeSubstituir}
        />
      </form>
    </section>
  );
}
