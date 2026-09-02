/**
 * Gera os ícones do PWA.
 *
 * Desenha o "P" geometricamente em vez de rasterizar uma fonte: assim o
 * resultado é idêntico em qualquer máquina e o repositório não precisa de
 * nenhuma dependência de imagem.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BRAND = [0xc2, 0x41, 0x0c]; // terracota
const INK = [0xff, 0xff, 0xff];

// -----------------------------------------------------------------------------
// PNG
// -----------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

/** `pixels` é RGB, 3 bytes por pixel, sem alfa. */
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro adaptativo
  ihdr[12] = 0; // sem entrelaçamento

  // Cada scanline leva um byte de filtro na frente; 0 = sem filtro.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -----------------------------------------------------------------------------
// A marca
// -----------------------------------------------------------------------------

/**
 * Um "P": haste vertical à esquerda e a barriga como meio anel no alto.
 * `inset` é a fração da borda que fica livre — o ícone maskable precisa de
 * folga porque o Android recorta em círculo.
 */
function isInk(x, y, size, inset) {
  const pad = size * inset;
  const height = size - pad * 2;
  const stroke = height * 0.17;
  const outer = height * 0.31;

  // O glifo vai da borda esquerda da haste até a borda direita da barriga.
  // Centralizar por qualquer outra medida joga o P para um dos lados.
  const glyphWidth = stroke / 2 + outer;
  const left = (size - glyphWidth) / 2;
  const top = pad;
  const bottom = pad + height;

  // Haste
  if (x >= left && x <= left + stroke && y >= top && y <= bottom) return true;

  // Barriga: meio anel, só do centro da haste para a direita
  const cx = left + stroke / 2;
  const cy = top + outer;
  const inner = outer - stroke;

  if (x >= cx) {
    const distance = Math.hypot(x - cx, y - cy);
    if (distance >= inner && distance <= outer) return true;
  }

  return false;
}

function render(size, inset) {
  const pixels = Buffer.alloc(size * size * 3);
  const samples = 3; // supersampling, para a curva não sair serrilhada

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (isInk(px, py, size, inset)) hits++;
        }
      }

      const coverage = hits / (samples * samples);
      const offset = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(
          BRAND[c] * (1 - coverage) + INK[c] * coverage,
        );
      }
    }
  }

  return encodePng(size, size, pixels);
}

// -----------------------------------------------------------------------------

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const files = [
  ["icon-192.png", 192, 0.2],
  ["icon-512.png", 512, 0.2],
  // Zona segura do maskable: o recorte circular come os cantos.
  ["icon-maskable-512.png", 512, 0.28],
  ["apple-icon.png", 180, 0.18],
];

for (const [name, size, inset] of files) {
  const png = render(size, inset);
  writeFileSync(publicDir + name, png);
  console.log(`${name} — ${size}px, ${png.length} bytes`);
}
