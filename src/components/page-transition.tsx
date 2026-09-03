"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A animação de entrada de cada tela.
 *
 * A `key` é o caminho: quando ele muda, o React descarta o nó e monta outro, e
 * a animação de CSS roda de novo. Sem a key o elemento seria o mesmo entre
 * navegações e a animação só tocaria uma vez, no primeiro carregamento.
 *
 * O React tem `<ViewTransition>`, que faria o cruzamento entre a tela que sai
 * e a que entra, mas ele só existe no canal experimental do React — o Petire
 * está no estável. Uma animação de entrada resolve o corte seco sem pendurar o
 * app numa API que ainda muda.
 *
 * Só o conteúdo se move. O cabeçalho fica parado de propósito: é o ponto fixo
 * que diz ao cliente que ele continua no mesmo site.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
