"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { qrModules } from "@/lib/qr";

/**
 * As artes que o lojista publica.
 *
 * O link e a mensagem já existiam aqui, e os dois só funcionam onde cabe
 * texto. Onde o cliente dele realmente está — status do WhatsApp e Instagram —
 * o formato é imagem, e uma imagem que o lojista não tem ele não publica.
 *
 * PNG desenhado em `<canvas>`, e não SVG: é o PNG que o celular salva na
 * galeria com um toque longo, e é da galeria que sai o status. Converter o SVG
 * da página em imagem perderia a fonte no caminho — ver `qrModules()`.
 */

type Format = {
  id: "status" | "post";
  label: string;
  hint: string;
  width: number;
  height: number;
};

const FORMATS: Format[] = [
  {
    id: "status",
    label: "Status e stories",
    hint: "WhatsApp e Instagram, em pé.",
    width: 1080,
    height: 1920,
  },
  {
    id: "post",
    label: "Post do Instagram",
    hint: "Quadrado, para o feed.",
    width: 1080,
    height: 1080,
  },
];

const BRAND = "#c2410c";

export function Artes({
  storeName,
  url,
  shortUrl,
}: {
  storeName: string;
  url: string;
  shortUrl: string;
}) {
  const [format, setFormat] = useState<Format>(FORMATS[0]);
  const [image, setImage] = useState<string | null>(null);
  const modules = useRef(qrModules(url));

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      // A fonte da página só entra no canvas depois de carregada; sem esperar,
      // a arte sai na fonte de sistema em metade das vezes — e sempre na
      // primeira, que é a que o lojista vê.
      try {
        await document.fonts.ready;
      } catch {
        // Sem suporte: segue com a fonte que houver.
      }
      if (cancelled) return;

      const png = render({
        format,
        storeName,
        shortUrl,
        modules: modules.current,
      });
      if (!cancelled) setImage(png);
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [format, storeName, shortUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Arte para publicar</p>
        <div className="flex gap-2">
          {FORMATS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={item.id === format.id ? "primary" : "secondary"}
              onClick={() => setFormat(item)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {format.hint} No celular, segure a imagem para salvar na galeria.
      </p>

      {image ? (
        <>
          {/* `unoptimized`: a imagem já nasceu como data URL no browser, e
              não há servidor por onde otimizá-la. */}
          <Image
            src={image}
            alt={`Arte do ${storeName} para ${format.label.toLowerCase()}`}
            width={format.width}
            height={format.height}
            unoptimized
            className="mx-auto h-auto w-full max-w-64 rounded-xl border border-neutral-200 dark:border-neutral-800"
          />
          <div>
            {/* No computador o toque longo não existe; aqui o download é o
                caminho, e o mesmo PNG serve. */}
            <a
              href={image}
              download={`petire-${format.id}.png`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Baixar a imagem
            </a>
          </div>
        </>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Desenhando a arte…
        </p>
      )}
    </div>
  );
}

function render({
  format,
  storeName,
  shortUrl,
  modules,
}: {
  format: Format;
  storeName: string;
  shortUrl: string;
  modules: boolean[][];
}): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const family =
    getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, format.width, format.height);

  ctx.textAlign = "center";
  // Do topo, e não da linha de base: a arte é montada medindo alturas, e com a
  // base alfabética cada bloco ficaria deslocado pelo tamanho da própria
  // fonte.
  ctx.textBaseline = "top";

  const center = format.width / 2;
  const tall = format.id === "status";

  const eyebrow = tall ? 40 : 34;
  const nameSize = tall ? 100 : 74;
  // O QR ocupa dois terços da largura no formato em pé. Ele não é enfeite: é
  // fotografado da tela de outro celular, e o que sobra de margem só torna a
  // leitura mais difícil.
  const board = tall ? 680 : 420;
  const urlSize = tall ? 46 : 40;
  const footSize = tall ? 38 : 32;

  const gapAfterEyebrow = tall ? 56 : 38;
  const gapAfterName = tall ? 72 : 48;
  const gapAfterBoard = tall ? 76 : 56;
  const gapAfterUrl = tall ? 52 : 40;
  const footLine = footSize * 1.35;

  ctx.font = `700 ${nameSize}px ${family}`;
  const lines = wrap(ctx, storeName, format.width - 160);
  const nameHeight = lines.length * nameSize * 1.15;

  const total =
    eyebrow +
    gapAfterEyebrow +
    nameHeight +
    gapAfterName +
    board +
    gapAfterBoard +
    urlSize +
    gapAfterUrl +
    footLine * 2;

  // Centralizado, com um empurrão para cima no formato em pé: o rodapé do
  // status é coberto pela barra de resposta do WhatsApp, e o que ficar ali
  // ninguém lê.
  let y = Math.max(
    60,
    (format.height - total) / 2 - (tall ? format.height * 0.03 : 0),
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${eyebrow}px ${family}`;
  ctx.fillText("PEÇA DIRETO DA LOJA", center, y);
  y += eyebrow + gapAfterEyebrow;

  ctx.font = `700 ${nameSize}px ${family}`;
  for (const line of lines) {
    ctx.fillText(line, center, y);
    y += nameSize * 1.15;
  }
  y += gapAfterName - (nameSize * 1.15 - nameSize);

  // O QR é preto sobre branco, sempre. Sobre o terracota ele perde contraste e
  // deixa de ler — e um QR que não lê transforma a arte em enfeite.
  const quiet = 4;
  const cell = board / (modules.length + quiet * 2);
  const boardX = center - board / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(boardX, y, board, board);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < modules.length; row++) {
    for (let column = 0; column < modules.length; column++) {
      if (!modules[row][column]) continue;
      ctx.fillRect(
        boardX + (column + quiet) * cell,
        y + (row + quiet) * cell,
        cell,
        cell,
      );
    }
  }
  y += board + gapAfterBoard;

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${urlSize}px ${family}`;
  ctx.fillText(shortUrl, center, y);
  y += urlSize + gapAfterUrl;

  ctx.font = `400 ${footSize}px ${family}`;
  ctx.fillText("Cardápio completo e pedido no nosso", center, y);
  ctx.fillText("WhatsApp. Sem app e sem cadastro.", center, y + footLine);

  return canvas.toDataURL("image/png");
}

/** Quebra o nome da loja em linhas que cabem na arte. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}
