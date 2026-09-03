"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

/**
 * Copiar sem sair da tela.
 *
 * O lojista está no celular e o próximo passo é colar no WhatsApp ou na bio do
 * Instagram. Selecionar texto com o dedo é onde ele desiste e digita o link
 * errado.
 *
 * `navigator.clipboard` não existe fora de HTTPS e pode ser negado pelo
 * browser; nesse caso o texto continua na tela para copiar à mão, e o botão
 * diz o que houve em vez de fingir que deu certo.
 */
export function CopyButton({
  text,
  label = "Copiar",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copiado" | "erro">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copiado");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("erro");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" onClick={copy}>
        {state === "copiado" ? "Copiado" : label}
      </Button>
      {state === "erro" ? (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Copie o texto à mão.
        </span>
      ) : null}
    </div>
  );
}
