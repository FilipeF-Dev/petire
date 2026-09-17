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

import { z } from "zod";

export type ParsedOption = {
  name: string;
  /** Quanto esta opção soma ao preço do item. */
  plusCents: number;
};

export type ParsedGroup = {
  name: string;
  /** Quantas o cliente é obrigado a escolher. Zero é grupo opcional. */
  min: number;
  max: number;
  options: ParsedOption[];
};

export type ParsedItem = {
  name: string;
  priceCents: number;
  /** Só o formato estruturado carrega estes três. */
  description?: string | null;
  /** Grupos próprios deste item. */
  groups?: ParsedGroup[];
  /**
   * Apelidos de grupos declarados no topo do cardápio e usados por vários
   * itens — "Adicionais" nos doze hambúrgueres da casa.
   */
  uses?: string[];
};

export type ParsedSection = {
  /** null quando o item veio antes de qualquer título de seção. */
  category: string | null;
  items: ParsedItem[];
};

export type ParsedMenu = {
  sections: ParsedSection[];
  /**
   * Os grupos declarados uma vez e usados por vários itens, por apelido.
   *
   * Existe porque repetir o grupo dentro de cada item criaria um grupo por
   * item: o lojista mudaria o preço do bacon num hambúrguer e continuaria
   * errado nos outros onze. É a mesma razão de o grupo ter deixado de
   * pertencer ao produto no banco — ver product_option_groups.
   */
  shared?: Record<string, ParsedGroup>;
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

/* ---------------------------------------------------------------------------
 * O cardápio estruturado
 *
 * O formato de linhas acima é generoso porque ele lê o que uma pessoa já tem
 * escrito. Só que ele para onde o cardápio começa a ficar interessante: o que
 * vai dentro do lanche. Grupo de opção precisa de quatro conceitos — seção,
 * item, grupo (obrigatório? quantos?) e opção (+quanto) — e de hierarquia, e
 * hierarquia não cabe numa regra de "preço no fim da linha".
 *
 * Quem escreve este segundo formato não é o lojista: é o suporte do Petire,
 * com um cardápio que uma IA leu de uma foto ou de um PDF. E isso muda o que
 * o formato precisa ser. Ele não precisa mais parecer com o que a pessoa já
 * tem — precisa ser o que a máquina acerta sempre. Daí JSON: sem ambiguidade,
 * validado de uma vez, e errando com o caminho exato do campo em vez de
 * adivinhar e seguir em frente.
 *
 * Os dois entram pelo mesmo campo de texto, porque a diferença é óbvia para
 * quem lê e para o código: cardápio nenhum começa com uma chave.
 * ------------------------------------------------------------------------ */

const REAIS_MAX = MAX_CENTS / 100;

/** Reais como a IA escreve (24.9, 24) viram centavos como o banco guarda. */
function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

const opcaoSchema = z.object({
  nome: z.string().trim().min(1, "Opção sem nome.").max(120),
  /** Quanto esta opção soma ao preço do item. Zero quando não soma nada. */
  mais: z.number().min(0).max(REAIS_MAX).default(0),
});

const grupoSchema = z
  .object({
    nome: z.string().trim().min(1, "Grupo sem nome.").max(120),
    /** Quantas o cliente é obrigado a escolher. Zero é grupo opcional. */
    min: z.number().int().min(0).max(20).default(0),
    /** Quantas ele pode escolher no máximo. */
    max: z.number().int().min(1).max(20).default(1),
    opcoes: z.array(opcaoSchema).min(1, "Grupo sem nenhuma opção.").max(50),
  })
  .refine((grupo) => grupo.max >= grupo.min, {
    message: "O máximo de escolhas não pode ser menor que o mínimo.",
  });

const itemSchema = z.object({
  nome: z.string().trim().min(1, "Item sem nome.").max(120),
  /**
   * Em reais, e não em centavos: quem escreve isto lê o cardápio em reais, e
   * pedir centavos aqui é convidar o erro de cem vezes.
   *
   * Zero é legítimo — é o item cujo preço mora numa opção obrigatória, como a
   * Fanta que custa pelo sabor. O cardápio mostra "a partir de" sozinho.
   */
  preco: z.number().min(0).max(REAIS_MAX).default(0),
  descricao: z.string().trim().max(500).optional(),
  /** Grupos só deste item. */
  grupos: z.array(grupoSchema).max(10).optional(),
  /** Apelidos de grupos declarados no topo. */
  usa: z.array(z.string().trim().min(1)).max(10).optional(),
});

const cardapioSchema = z.object({
  /**
   * Grupos que vários itens usam, cada um com um apelido.
   *
   * O apelido é só para o texto se referir a ele; o que vai para o cardápio é
   * o `nome`. Declarar aqui e citar com `usa` é o que faz "Adicionais" ser
   * **um** grupo em doze hambúrgueres, e não doze.
   */
  grupos: z.record(z.string(), grupoSchema).optional(),
  secoes: z
    .array(
      z.object({
        nome: z.string().trim().max(80).optional(),
        itens: z.array(itemSchema).min(1, "Seção sem nenhum item."),
      }),
    )
    .min(1, "Nenhuma seção no cardápio."),
});

/** O caminho do campo que falhou, como a pessoa lê: secoes[0].itens[2].preco */
function caminho(issue: z.core.$ZodIssue): string {
  return issue.path.reduce<string>((texto, parte) => {
    if (typeof parte === "number") return `${texto}[${parte}]`;
    return texto === "" ? String(parte) : `${texto}.${String(parte)}`;
  }, "");
}

export type ParsedMenuResult = {
  menu: ParsedMenu;
  /** Nulo quando deu certo. O texto de linhas nunca falha; o JSON pode. */
  erro: string | null;
  /** Verdadeiro quando o texto foi lido como JSON. */
  estruturado: boolean;
};

const VAZIO: ParsedMenu = { sections: [], ignored: [], total: 0 };

function lerJson(text: string): ParsedMenuResult {
  let bruto: unknown;
  try {
    bruto = JSON.parse(text);
  } catch {
    return {
      menu: VAZIO,
      erro: "O texto começa como JSON mas não é um JSON válido.",
      estruturado: true,
    };
  }

  // Um array sozinho é entendido como a lista de seções: é o que uma IA
  // devolve quando alguém pede "só as seções".
  const parsed = cardapioSchema.safeParse(
    Array.isArray(bruto) ? { secoes: bruto } : bruto,
  );

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const onde = caminho(issue);
    return {
      menu: VAZIO,
      erro: onde ? `${onde}: ${issue.message}` : issue.message,
      estruturado: true,
    };
  }

  const converter = (grupo: {
    nome: string;
    min: number;
    max: number;
    opcoes: { nome: string; mais: number }[];
  }): ParsedGroup => ({
    name: grupo.nome,
    min: grupo.min,
    // Um grupo que obriga escolher duas e só permite uma é um item que ninguém
    // consegue pedir. O schema já recusa; isto é cinto e suspensório.
    max: Math.max(grupo.max, grupo.min),
    options: grupo.opcoes.map((opcao) => ({
      name: opcao.nome,
      plusCents: reaisParaCentavos(opcao.mais),
    })),
  });

  const shared: Record<string, ParsedGroup> = {};
  for (const [apelido, grupo] of Object.entries(parsed.data.grupos ?? {})) {
    shared[apelido] = converter(grupo);
  }

  const sections: ParsedSection[] = [];
  let total = 0;
  const ignored: string[] = [];

  for (const secao of parsed.data.secoes) {
    const items: ParsedItem[] = [];

    for (const item of secao.itens) {
      /*
        O mesmo teto do formato de linhas, mas aqui ele **recusa** em vez de
        cortar o excedente.

        No texto colado, jogar o resto para "fora da importação" é razoável:
        quem colou não escreveu aquilo linha a linha e vai conferir a lista de
        qualquer jeito. Aqui o JSON foi construído de propósito, e sumir com os
        últimos itens em silêncio seria entregar um cardápio pela metade a quem
        acha que entregou inteiro.

        E o caminho certo quase nunca é colar em duas partes: um cardápio que
        passa de 200 costuma ser um cardápio com cinquenta sabores listados um
        a um. A regra de agrupar variações, que está no pedido à IA, levou um
        cardápio real de 221 itens para 85 sem perder um sabor sequer.
      */
      if (total >= MAX_ITEMS) {
        return {
          menu: VAZIO,
          erro: `O cardápio tem mais de ${MAX_ITEMS} itens. Agrupe as variações do mesmo produto (tamanho, sabor, recheio) num item com grupo de opção, como pede o formato.`,
          estruturado: true,
        };
      }

      /*
        Apelido citado que ninguém declarou é erro, e não um grupo a menos em
        silêncio. É o engano mais provável de uma transcrição feita por IA — ela
        escreve "usa": ["adicionais"] e esquece de declarar "adicionais" no topo
        — e o sintoma sem esta checagem seria um item chegando ao cardápio sem
        as opções, sem nada avisando.
      */
      const desconhecido = (item.usa ?? []).find(
        (apelido) => !(apelido in shared),
      );

      if (desconhecido) {
        return {
          menu: VAZIO,
          erro: `O item "${item.nome}" usa o grupo "${desconhecido}", que não foi declarado em "grupos".`,
          estruturado: true,
        };
      }

      items.push({
        name: item.nome,
        priceCents: reaisParaCentavos(item.preco),
        description: item.descricao ?? null,
        groups: item.grupos?.map(converter),
        uses: item.usa,
      });
      total += 1;
    }

    if (items.length > 0) {
      sections.push({ category: secao.nome?.trim() || null, items });
    }
  }

  if (total === 0) {
    return {
      menu: VAZIO,
      erro: "O JSON não tem nenhum item.",
      estruturado: true,
    };
  }

  return {
    menu: { sections, ignored, total, shared },
    erro: null,
    estruturado: true,
  };
}

/**
 * Lê o que foi colado, seja lá qual for o formato.
 *
 * É esta que a tela e a Server Action chamam — as duas, com o mesmo texto. A
 * conferência que o browser mostra sai da mesma função que grava, e é isso que
 * torna aceitável um formato que adivinha.
 */
export function parseMenuInput(text: string): ParsedMenuResult {
  const limpo = text.trim();

  if (limpo.startsWith("{") || limpo.startsWith("[")) return lerJson(limpo);

  return { menu: parseMenu(text), erro: null, estruturado: false };
}
