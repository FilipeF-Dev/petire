import { describe, expect, it } from "vitest";

import { approachFor, fitRank, type Survey } from "./prospects";

function survey(overrides: Partial<Survey> = {}): Survey {
  return {
    has_menu: false,
    has_whatsapp: false,
    on_app: false,
    ...overrides,
  };
}

describe("approachFor", () => {
  it("no aplicativo, a dor é comissão", () => {
    expect(approachFor(survey({ on_app: true })).label).toBe("comissão");
  });

  it("o aplicativo ganha de não ter cardápio à vista", () => {
    // Quem está no app tem cardápio online — o do app. A dor dele é o que
    // aquele cardápio custa, e ela fecha sozinha numa conta.
    const both = approachFor(survey({ on_app: true, has_menu: false }));

    expect(both.label).toBe("comissão");
  });

  it("fora do aplicativo e sem cardápio, a dor é vitrine", () => {
    expect(approachFor(survey({ has_menu: false })).label).toBe("vitrine");
  });

  it("com cardápio e WhatsApp, o ganho é o pedido chegar escrito", () => {
    const approach = approachFor(
      survey({ has_menu: true, has_whatsapp: true }),
    );

    expect(approach.label).toBe("pedido pronto");
  });

  it("sem WhatsApp na fachada, manda confirmar antes de gastar a visita", () => {
    const approach = approachFor(
      survey({ has_menu: true, has_whatsapp: false }),
    );

    expect(approach.label).toBe("confirmar encaixe");
  });
});

describe("fitRank", () => {
  it("põe na frente quem paga comissão e já atende no WhatsApp", () => {
    expect(fitRank(survey({ on_app: true, has_whatsapp: true }))).toBe(0);
  });

  it("ordena do encaixe mais claro para o mais duvidoso", () => {
    const ordem = [
      survey({ on_app: true, has_whatsapp: true }),
      survey({ on_app: true }),
      survey({ has_whatsapp: true }),
      survey({ has_menu: true, has_whatsapp: true }),
      survey({ has_menu: true }),
    ].map(fitRank);

    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
  });

  it("deixa por último a loja de que só se sabe o nome", () => {
    expect(fitRank(survey({ has_menu: true }))).toBe(5);
  });
});
