import qrcode from "qrcode-generator";

/**
 * O QR code da loja, como SVG.
 *
 * SVG e não imagem: o cartaz vai para a impressora, e um PNG de 200px colado
 * numa folha A4 sai serrilhado — um QR serrilhado é um QR que não lê. Como
 * vetor, ele é nítido em qualquer tamanho e ainda vai inline no HTML, sem uma
 * segunda ida ao servidor.
 *
 * O código é gerado por biblioteca de propósito. Desenhar o "P" dos ícones à
 * mão foi barato e o erro seria visível; errar a correção de erro ou a máscara
 * de um QR dá um cartaz impresso que simplesmente não escaneia, e ninguém
 * descobre até o cliente tentar.
 *
 * Correção de erro M: aguenta cerca de 15% do código danificado, que é o que
 * um papel colado no balcão sofre.
 */
export function qrSvgPath(text: string): { path: string; size: number } {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  const parts: string[] = [];

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (qr.isDark(row, column)) {
        parts.push(`M${column} ${row}h1v1h-1z`);
      }
    }
  }

  return { path: parts.join(""), size };
}
