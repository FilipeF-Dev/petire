"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Estamos no navegador?
 *
 * Falso no servidor e no primeiro render do cliente, verdadeiro depois da
 * hidratação — que é exatamente quando `document.body` passa a existir para o
 * portal. Nada nunca muda depois disso, então a assinatura não faz nada.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * A caixa que abre por cima da tela — escolher endereço, montar um item,
 * conferir a entrega.
 *
 * Nasceu de três cópias do mesmo `fixed inset-0` espalhadas pelo site, que já
 * tinham começado a divergir. O que decidiu extrair foi o `createPortal`: um
 * pop-up preso à árvore da página fica à mercê de qualquer `transform` num
 * ancestral, porque transform cria bloco de contenção e `position: fixed`
 * passa a medir a partir dele em vez da janela. O Petire tem exatamente isso
 * na animação de troca de tela, e o resultado era um pop-up ancorado no
 * rodapé, com parte fora da vista. Pendurado no `body`, ele não tem ancestral
 * para ser afetado por.
 *
 * Centralizado nas duas dimensões, e em qualquer largura. Havia uma variante
 * colada no rodapé no celular — o padrão de "bottom sheet" —, mas ela deixava
 * os botões rentes à borda inferior, onde o navegador do telefone desenha a
 * própria barra por cima.
 */
export function Modal({
  label,
  onClose,
  panelClassName = "w-full max-w-md gap-4 overflow-y-auto p-5",
  children,
}: {
  /** Lido pelo leitor de tela no lugar de um título visual. */
  label: string;
  onClose: () => void;
  /**
   * Largura, recheio e como o conteúdo rola. O padrão rola o painel inteiro;
   * quem tem cabeçalho ou rodapé fixo passa `overflow-hidden` e cuida da
   * própria área de rolagem.
   */
  panelClassName?: string;
  children: ReactNode;
}) {
  const isBrowser = useSyncExternalStore(neverChanges, onClient, onServer);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!isBrowser) return null;

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className={`modal-panel flex max-h-[85dvh] flex-col rounded-2xl bg-surface ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
