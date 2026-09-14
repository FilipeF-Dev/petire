import { describe, expect, it } from "vitest";

import {
  precoACombinar,
  requiredExtraCents,
  startingPrice,
} from "./menu-price";

const tamanho = (min: number) => ({
  min_select: min,
  options: [
    { price_delta_cents: 1250, is_available: true },
    { price_delta_cents: 2450, is_available: true },
  ],
});

describe("startingPrice", () => {
  // O caso real que originou isto: Batata Frita a R$ 0,00 com tamanho
  // obrigatório. O card mostrava zero.
  it("soma a escolha obrigatória mais barata", () => {
    expect(startingPrice(0, [tamanho(1)])).toEqual({
      cents: 1250,
      isFrom: true,
    });
  });

  it("não mexe no preço quando o grupo é opcional", () => {
    expect(startingPrice(2490, [tamanho(0)])).toEqual({
      cents: 2490,
      isFrom: false,
    });
  });

  it("item sem grupo nenhum continua com o preço dele", () => {
    expect(startingPrice(1990, [])).toEqual({ cents: 1990, isFrom: false });
  });

  // Opção obrigatória de graça — "ponto da carne" — não vira "a partir de":
  // o preço do card é o preço final.
  it("ignora obrigatório sem acréscimo", () => {
    const ponto = {
      min_select: 1,
      options: [
        { price_delta_cents: 0, is_available: true },
        { price_delta_cents: 0, is_available: true },
      ],
    };

    expect(startingPrice(2490, [ponto])).toEqual({
      cents: 2490,
      isFrom: false,
    });
  });

  // "Sem cebola, −R$ 2,00" não faz o item começar mais barato: o cliente pode
  // escolher a opção que não abate.
  it("não deixa desconto puxar o preço de entrada para baixo", () => {
    const remover = {
      min_select: 1,
      options: [
        { price_delta_cents: -200, is_available: true },
        { price_delta_cents: 0, is_available: true },
      ],
    };

    expect(startingPrice(2490, [remover])).toEqual({
      cents: 2490,
      isFrom: false,
    });
  });

  it("não conta opção esgotada", () => {
    const grupo = {
      min_select: 1,
      options: [
        { price_delta_cents: 500, is_available: false },
        { price_delta_cents: 1200, is_available: true },
      ],
    };

    expect(startingPrice(0, [grupo]).cents).toBe(1200);
  });

  it("grupo esgotado inteiro não trava o item", () => {
    const grupo = {
      min_select: 1,
      options: [{ price_delta_cents: 500, is_available: false }],
    };

    expect(startingPrice(1990, [grupo])).toEqual({
      cents: 1990,
      isFrom: false,
    });
  });

  it("soma quando o grupo obriga mais de uma escolha", () => {
    expect(requiredExtraCents([{ ...tamanho(2) }])).toBe(2500);
  });
});

describe("precoACombinar", () => {
  /*
    Nasceu de um cardápio de produção: cinco itens a R$ 0,00, esperando a regra
    de "escolha o tamanho". Até ela chegar, o cardápio anunciava comida de graça
    e o Google recebia "a partir de R$ 0,00" na faixa de preço da loja.
  */
  it("item sem preço e sem grupo obrigatório fica a combinar", () => {
    expect(precoACombinar(startingPrice(0, []))).toBe(true);
  });

  it("item de graça por escolha do lojista não existe aqui", () => {
    // Não há como distinguir "de graça" de "não digitei", e errar para o lado
    // de "a combinar" custa uma pergunta no WhatsApp; errar para o outro lado
    // custa um pedido que a loja não vai honrar.
    expect(precoACombinar(startingPrice(0, []))).toBe(true);
  });

  it("o item que começa em zero mas obriga escolher já tem preço", () => {
    const grupos = [
      {
        min_select: 1,
        options: [
          { price_delta_cents: 1250, is_available: true },
          { price_delta_cents: 2450, is_available: true },
        ],
      },
    ];

    expect(precoACombinar(startingPrice(0, grupos))).toBe(false);
    expect(startingPrice(0, grupos)).toEqual({ cents: 1250, isFrom: true });
  });

  it("preço normal não vira a combinar", () => {
    expect(precoACombinar(startingPrice(2490, []))).toBe(false);
  });
});
