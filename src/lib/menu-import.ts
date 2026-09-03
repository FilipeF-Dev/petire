/**
 * Lê um cardápio colado como texto.
 *
 * Digitar trinta itens no celular é o que faz o lojista largar o cadastro pela
 * metade — e um cardápio pela metade é pior do que nenhum, porque o cliente
 * pede o que não existe. Todo lojista já tem o cardápio escrito em algum
 * lugar: no bloco de notas, no PDF do gráfico, na mensagem que ele manda no
 * WhatsApp. Colar isso é um toque.
 *
 * A regra é uma só, e é a que a pessoa já usa sem pensar: **linha com preço no
 * fim é item; linha sem preço é o nome de uma seção**. É assim que cardápio de
 * papel é escrito, então o texto que ela cola já vem quase certo.
 *
 * Nada é gravado direto: o que sai daqui vai para uma conferência antes.
 * Adivinhar preço errado e publicar sozinho seria o pior dos dois mundos.
 */

export type ParsedItem = {
  name: string;
  priceCents: number;
};

export type ParsedSection = {
  /** null quando o item veio antes de qualquer título de seção. */
  category: string | null;
  items: ParsedItem[];
};

export type ParsedMenu = {
  sections: ParsedSection[];
  /** Linhas que não viraram nada, para a tela poder mostrar o que ignorou. */
  ignored: string[];
  total: number;
};

/** Teto por importação: colar um livro inteiro não deve derrubar a tela. */
const MAX_ITEMS = 200;

/** O mesmo teto de preço do schema dos produtos. */
const MAX_CENTS = 99_999_99;

/**
 * Preço no fim da linha, com ou sem "R$".
 *
 * Aceita "24,90", "24.90", "1.500,00" e o inteiro seco ("Água 3"). Os centavos
 * exigem duas casas de propósito: sem isso, "Pizza 4 queijos" viraria uma
 * pizza de R$ 0,40.
 */
const PRICE_AT_END =
  /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:[.,]\d{2})?)\s*$/i;

/** Marcadores de lista que vêm colados junto: "- ", "• ", "1. ", "2) ". */
const LEADING_MARKER = /^\s*(?:[-–—•*·]|\d{1,2}[.)])\s+/;

/** Pontilhado, bolinha ou travessão que liga o nome ao preço no papel. */
const TRAILING_SEPARATORS = /[\s.·•*:\-–—]+$/;

function toCents(raw: string): number | null {
  // "1.500,00" — o ponto aqui é separador de milhar, não decimal.
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  const cents = Math.round(value * 100);
  return cents > MAX_CENTS ? null : cents;
}

export function parseMenu(text: string): ParsedMenu {
  const sections: ParsedSection[] = [];
  const ignored: string[] = [];
  let current: ParsedSection | null = null;
  let total = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(LEADING_MARKER, "").trim();
    if (line === "") continue;

    if (total >= MAX_ITEMS) {
      ignored.push(line);
      continue;
    }

    const match = PRICE_AT_END.exec(line);
    const cents = match ? toCents(match[1]) : null;

    if (match && cents !== null) {
      const name = line.slice(0, match.index).replace(TRAILING_SEPARATORS, "");

      // "R$ 24,90" numa linha sozinha não diz que item é esse.
      if (name === "") {
        ignored.push(line);
        continue;
      }

      if (!current) {
        current = { category: null, items: [] };
        sections.push(current);
      }

      current.items.push({ name, priceCents: cents });
      total += 1;
      continue;
    }

    // Sem preço: é título de seção. Começa uma nova, mesmo que a anterior
    // tenha ficado vazia — quem cola sabe o que é título.
    current = { category: line, items: [] };
    sections.push(current);
  }

  // Seção sem item nenhum não é seção: é uma linha solta que o texto tinha —
  // "Entregamos até 23h", o telefone da loja. Ela volta como ignorada para a
  // tela mostrar, em vez de virar uma categoria vazia no cardápio.
  const kept: ParsedSection[] = [];
  for (const section of sections) {
    if (section.items.length === 0) {
      if (section.category) ignored.push(section.category);
      continue;
    }
    kept.push(section);
  }

  return { sections: kept, ignored, total };
}
