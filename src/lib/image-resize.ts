/**
 * Encolhe a foto no browser, antes de ela subir.
 *
 * O lojista fotografa o lanche com o celular e o arquivo tem 2 a 4 MB. Sem
 * isto, é esse arquivo que vai para o Storage e é ele que fica lá para sempre:
 * um cardápio de 40 itens ocupa uns 100 MB, e quarenta lojas enchem um plano
 * pago sozinhas.
 *
 * O tamanho é generoso de propósito. Hoje a foto aparece a 80px na vitrine e
 * 44px no painel, então 1024px é umas quatro vezes o necessário — a folga
 * existe porque o original é o que sobra: se um dia o cardápio ganhar uma foto
 * grande, não dá para pedir a todo mundo que reenvie o que já mandou. O que o
 * cliente baixa continua sendo a versão que o `next/image` gera para o tamanho
 * da tela dele.
 *
 * WebP porque é o menor dos formatos que o bucket aceita e mantém
 * transparência. Onde ele não existir, JPEG resolve.
 */

/** Maior lado da imagem guardada. */
const MAX_SIDE = 1024;

/** Compressão. 0.8 é o ponto onde foto de comida ainda não mostra artefato. */
const QUALITY = 0.8;

/**
 * Teto do que aceitamos abrir. Não é o limite do bucket — é o ponto em que
 * decodificar no celular começa a travar a aba.
 */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // `imageOrientation` respeita o EXIF: sem isso, foto tirada de lado sobe
  // deitada, e o lojista não tem como girar.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari antigo não aceita a opção. Cai no <img>, que já orienta sozinho.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("imagem ilegível"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Devolve a versão encolhida, ou o próprio arquivo quando encolher não ajuda.
 *
 * Nunca devolve algo maior do que recebeu: uma imagem já pequena e já
 * comprimida costuma crescer ao ser reencodada, e trocar por uma pior seria o
 * contrário do objetivo.
 */
export async function resizeImage(file: File): Promise<File> {
  const source = await decode(file);

  const width = source.width;
  const height = source.height;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  let blob = await toBlob(canvas, "image/webp", QUALITY);
  let type = "image/webp";

  if (!blob) {
    // Sem WebP, o fundo branco entra antes: JPEG não tem transparência, e sem
    // isso um PNG com fundo vago viraria uma foto com fundo preto.
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    blob = await toBlob(canvas, "image/jpeg", QUALITY);
    type = "image/jpeg";
  }

  if (!blob || blob.size >= file.size) return file;

  const extension = type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]+$/, "");

  return new File([blob], `${name}.${extension}`, { type });
}
