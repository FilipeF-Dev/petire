"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
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
  const panel = useRef<HTMLDivElement>(null);

  /*
    Este efeito mexe no foco, então ele roda **uma vez**, na abertura, e desfaz
    na hora de fechar. Nada aqui pode depender de valor que muda a cada render.

    Foi exatamente esse o bug: o `onClose` estava nas dependências, e todo
    chamador passa uma função escrita na hora (`onClose={() => setIsOpen(false)}`),
    que é uma função nova a cada render. Digitar uma letra na observação do item
    mudava o estado, o render trazia um `onClose` novo, o efeito se desmontava
    e se remontava — devolvendo o foco ao botão de trás e depois trazendo para o
    painel. No computador isso é um piscar; no celular, o teclado descia a cada
    letra digitada, e escrever "sem cebola" virava uma luta.

    O ouvinte de tecla precisa do `onClose` atual, e por isso ficou no efeito
    de baixo, que pode se reinscrever à vontade: registrar ouvinte não move o
    foco de ninguém.
  */
  useEffect(() => {
    /*
      O foco entra no diálogo e não sai enquanto ele estiver aberto.

      Sem isto, o pop-up era um diálogo só para quem enxerga: o Esc fechava e a
      rolagem do fundo travava, mas o Tab continuava passeando pelos links da
      página atrás — quem navega por teclado ou leitor de tela ficava lendo o
      cardápio enquanto o formulário de endereço estava na frente.

      Ao fechar, o foco volta para o elemento que abriu. É o que evita a pessoa
      ser jogada no topo da página depois de escolher um endereço.
    */
    const anterior = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
      anterior?.focus?.();
    };
    // `isBrowser` entra nas dependências porque o painel só existe depois que
    // ele vira verdadeiro: sem isso, um diálogo que abrisse junto com a
    // hidratação nunca receberia o foco.
  }, [isBrowser]);

  useEffect(() => {
    const focaveis = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((elemento) => elemento.offsetParent !== null);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const lista = focaveis();
      if (lista.length === 0) {
        // Diálogo sem nada focável: o Tab não tem para onde ir aqui dentro, e
        // deixá-lo escapar seria pior do que prendê-lo no próprio painel.
        event.preventDefault();
        panel.current?.focus();
        return;
      }

      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;

      if (event.shiftKey && (atual === primeiro || atual === panel.current)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && atual === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isBrowser) return null;

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // Para o painel poder receber o foco de entrada sem virar, depois
        // disso, mais uma parada do Tab.
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`modal-panel flex max-h-[85dvh] flex-col rounded-2xl bg-surface ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
