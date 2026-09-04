import { describe, expect, it } from "vitest";

import {
  brasiliaNow,
  formatOpening,
  nextOpening,
  openingLabel,
  type OpeningHour,
} from "./opening";

/** 0 = domingo, igual a `store_hours.weekday`. */
const SUN = 0;
const MON = 1;
const FRI = 5;
const SAT = 6;

function hour(weekday: number, opens_at: string): OpeningHour {
  return { weekday, opens_at };
}

describe("brasiliaNow", () => {
  it("lê o relógio de Brasília, não o do servidor", () => {
    // 2026-09-04 é uma sexta. 12:00 UTC é 09:00 em Brasília (UTC-3).
    const now = brasiliaNow(new Date("2026-09-04T12:00:00Z"));

    expect(now.weekday).toBe(FRI);
    expect(now.minutes).toBe(9 * 60);
  });

  it("vira o dia junto com Brasília, não com o UTC", () => {
    // 23:00 de sexta em Brasília ainda é sábado em UTC. Quem manda é o balcão.
    const now = brasiliaNow(new Date("2026-09-05T02:00:00Z"));

    expect(now.weekday).toBe(FRI);
    expect(now.minutes).toBe(23 * 60);
  });

  it("meia-noite é minuto zero, não o dia inteiro", () => {
    // Alguns motores devolvem "24" com hour12: false. 24*60 empurraria o
    // cliente para o dia seguinte inteiro.
    const now = brasiliaNow(new Date("2026-09-04T03:00:00Z"));

    expect(now.minutes).toBe(0);
    expect(now.weekday).toBe(FRI);
  });
});

describe("nextOpening", () => {
  it("acha a abertura que ainda vai acontecer hoje", () => {
    const next = nextOpening([hour(FRI, "18:00:00")], {
      weekday: FRI,
      minutes: 10 * 60,
    });

    expect(next).toEqual({ weekday: FRI, minutes: 18 * 60, daysAhead: 0 });
  });

  it("ignora a abertura de hoje que já passou", () => {
    // Às 23h a loja que abre às 18h não abre mais hoje — ela fechou.
    const next = nextOpening(
      [hour(FRI, "18:00:00"), hour(SAT, "11:00:00")],
      { weekday: FRI, minutes: 23 * 60 },
    );

    expect(next).toEqual({ weekday: SAT, minutes: 11 * 60, daysAhead: 1 });
  });

  it("pega a primeira das duas faixas do mesmo dia", () => {
    // Almoço e jantar. A resposta é o almoço, não a primeira linha da tabela.
    const next = nextOpening(
      [hour(SAT, "18:00:00"), hour(SAT, "11:00:00")],
      { weekday: SAT, minutes: 8 * 60 },
    );

    expect(next?.minutes).toBe(11 * 60);
  });

  it("dá a volta na semana quando a loja só abre num dia", () => {
    // Domingo à noite, feira que só abre no domingo: a próxima é daqui a uma
    // semana. Sem varrer os sete dias, isso viraria "sem previsão".
    const next = nextOpening([hour(SUN, "08:00:00")], {
      weekday: SUN,
      minutes: 20 * 60,
    });

    expect(next).toEqual({ weekday: SUN, minutes: 8 * 60, daysAhead: 7 });
  });

  it("devolve nulo quando não há horário cadastrado", () => {
    expect(nextOpening([], { weekday: FRI, minutes: 600 })).toBeNull();
  });
});

describe("formatOpening", () => {
  it("chama hoje de hoje e amanhã de amanhã", () => {
    expect(
      formatOpening({ weekday: FRI, minutes: 18 * 60, daysAhead: 0 }),
    ).toBe("abre hoje às 18:00");
    expect(
      formatOpening({ weekday: SAT, minutes: 11 * 60 + 30, daysAhead: 1 }),
    ).toBe("abre amanhã às 11:30");
  });

  it("usa o nome do dia quando está mais longe", () => {
    expect(formatOpening({ weekday: MON, minutes: 8 * 60, daysAhead: 3 })).toBe(
      "abre segunda às 08:00",
    );
  });

  it("devolve nulo quando não há próxima abertura", () => {
    expect(formatOpening(null)).toBeNull();
  });
});

describe("openingLabel", () => {
  const hours = [hour(FRI, "18:00:00"), hour(SAT, "11:00:00")];

  it("responde a pergunta do cliente que chegou fora do horário", () => {
    const label = openingLabel(hours, null, new Date("2026-09-04T12:00:00Z"));
    expect(label).toBe("abre hoje às 18:00");
  });

  it("não promete hora nenhuma quando o lojista fechou na mão", () => {
    // O horário cadastrado deixou de valer: ele reabre quando quiser, e
    // anunciar "abre às 18:00" seria inventar uma promessa por ele.
    const label = openingLabel(hours, false, new Date("2026-09-04T12:00:00Z"));
    expect(label).toBeNull();
  });

  it("o horário volta a valer quando o override é liberado", () => {
    // `is_open_manual = true` é a loja aberta na marra; se ela aparece fechada
    // mesmo assim, é porque a assinatura caiu — e o horário segue valendo.
    const label = openingLabel(hours, true, new Date("2026-09-04T12:00:00Z"));
    expect(label).toBe("abre hoje às 18:00");
  });
});
