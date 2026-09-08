"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui";

/**
 * O que vai para o papel: o cartaz do balcão e a folha de adesivos.
 *
 * Os dois vivem no mesmo componente por causa da impressão. O `@media print`
 * de `globals.css` esconde cabeçalho, navegação e rodapé, mas não sabe
 * escolher entre duas peças imprimíveis na mesma tela — sem esta escolha, quem
 * pede o cartaz recebe também quatro folhas de adesivo.
 *
 * Fundo branco e tinta preta nos dois, fixos: o cliente aponta a câmera para o
 * papel, e QR claro sobre fundo escuro não lê na maioria dos aparelhos.
 */

type Target = "cartaz" | "adesivos";

/** Oito por folha: o suficiente para uma semana de sacolas. */
const STICKERS = Array.from({ length: 8 }, (_, index) => index);

export function Printables({
  storeName,
  shortUrl,
  url,
  qr,
}: {
  storeName: string;
  shortUrl: string;
  url: string;
  qr: { path: string; size: number };
}) {
  const [target, setTarget] = useState<Target>("cartaz");

  function print(next: Target) {
    // `window.print()` congela a página no estado em que ela está, e o React
    // só pintaria a troca de peça depois que ele voltasse. Sem o `flushSync`,
    // o primeiro clique imprime a peça anterior.
    flushSync(() => setTarget(next));
    window.print();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div>
            <p className="text-sm font-medium">Cartaz para o balcão</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Uma folha, para colar onde o cliente espera o pedido.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => print("cartaz")}
          >
            Imprimir o cartaz
          </Button>
        </div>

        <div
          className={`rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-900 dark:border-neutral-800 print:border-0 ${
            target === "cartaz" ? "" : "print:hidden"
          }`}
        >
          <p className="text-sm tracking-wide uppercase">Peça pelo celular</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {storeName}
          </p>

          <Qr qr={qr} url={url} className="mx-auto my-6 size-56 print:size-72" />

          <p className="text-base font-medium">{shortUrl}</p>
          <p className="mt-2 text-sm text-neutral-600">
            Cardápio completo e pedido direto no nosso WhatsApp.
            <br />
            Sem app e sem cadastro.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div>
            <p className="text-sm font-medium">Adesivos para a sacola</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Oito por folha. O cartaz alcança quem está na loja; o adesivo vai
              junto com o pedido, para a casa de quem já comprou.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => print("adesivos")}
          >
            Imprimir os adesivos
          </Button>
        </div>

        <div
          className={`grid grid-cols-2 gap-3 rounded-xl bg-white p-4 text-neutral-900 sm:grid-cols-4 print:grid-cols-2 print:gap-0 print:p-0 ${
            target === "adesivos" ? "" : "print:hidden"
          }`}
        >
          {STICKERS.map((index) => (
            <div
              key={index}
              className="flex flex-col items-center rounded-lg border border-dashed border-neutral-300 p-3 text-center print:break-inside-avoid"
            >
              <p className="text-[10px] tracking-wide uppercase">
                Peça de novo pelo celular
              </p>
              <Qr qr={qr} url={url} className="my-2 size-20" />
              <p className="text-[11px] leading-tight font-medium break-all">
                {shortUrl}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-neutral-600">
                {storeName}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Qr({
  qr,
  url,
  className,
}: {
  qr: { path: string; size: number };
  url: string;
  className: string;
}) {
  return (
    <svg
      // Zona de silêncio de 4 módulos, como manda a especificação: QR colado
      // sem margem no papel escaneia mal.
      viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code para ${url}`}
    >
      <rect
        x={-4}
        y={-4}
        width={qr.size + 8}
        height={qr.size + 8}
        fill="#ffffff"
      />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}
