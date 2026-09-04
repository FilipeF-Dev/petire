import type { ReactNode } from "react";

import { Card } from "@/components/ui";
import { supportWhatsapp } from "@/lib/env";

/**
 * O que o plano de cima abre.
 *
 * Duas regras que valem para qualquer recurso que entre aqui:
 *
 *   o degrau é por **recurso**, nunca por volume de pedido — comissão zero é a
 *   razão de a loja estar no Petire, e cobrar mais de quem vende mais seria
 *   comissão com outro nome;
 *
 *   nada disto muda a vitrine. O cliente não vê plano nenhum, e a ordem da
 *   lista continua sendo por distância. Vender posição gastaria a confiança que
 *   traz o cliente de volta, que é o ativo mais caro que o produto tem.
 *
 * A tela mostra o recurso desligado em vez de escondê-lo do menu: um item que
 * some não é uma oferta, é uma dúvida.
 */
export function PlanLocked({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="max-w-lg p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>

      {children}

      {supportWhatsapp ? (
        <a
          href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
            "Olá! Quero saber sobre o plano Plus do Petire.",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-surface-hover dark:border-neutral-700"
        >
          Falar com o Petire
        </a>
      ) : null}
    </Card>
  );
}
