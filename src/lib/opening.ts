import { WEEKDAYS } from "./weekdays";

/**
 * Quando a loja fechada volta a abrir.
 *
 * Loja fechada não é beco sem saída: o cliente que montou o carrinho às 2h
 * quer saber se espera até de manhã ou se procura outra loja. Sem essa
 * resposta ele manda a mensagem assim mesmo, ninguém responde, e a culpa fica
 * dividida entre a loja e o Petire.
 *
 * O fuso é o de Brasília, o mesmo que `store_is_open()` usa no banco. Sem
 * fixá-lo, o horário do servidor da Vercel decidiria se a lanchonete está
 * aberta — e ele não tem nada a ver com o balcão.
 */

const BRASILIA = "America/Sao_Paulo";

/** Índice = `store_hours.weekday`, com 0 = domingo. */
const SHORT_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Só o que a conta precisa de `store_hours`. */
export type OpeningHour = {
  weekday: number;
  opens_at: string;
};

/** Um instante reduzido ao que importa aqui: que dia da semana, que horas. */
export type Moment = {
  weekday: number;
  /** Minutos desde a meia-noite. */
  minutes: number;
};

export type NextOpening = Moment & {
  /** 0 = ainda hoje, 1 = amanhã. Vai até 7, quando só abre neste mesmo dia. */
  daysAhead: number;
};

/** "18:30:00" → 1110 */
function toMinutes(time: string): number {
  const [hour, minute] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

/** 1110 → "18:30" */
function toClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function brasiliaNow(at: Date = new Date()): Moment {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRASILIA,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  // `hour12: false` devolve "24" à meia-noite em alguns motores, e 24*60 jogaria
  // o cliente para o dia seguinte inteiro.
  const hour = Number(value("hour")) % 24;

  return {
    weekday: SHORT_WEEKDAY[value("weekday")] ?? 0,
    minutes: hour * 60 + Number(value("minute")),
  };
}

/**
 * A próxima abertura a partir de agora, ou nulo quando não há horário
 * cadastrado.
 *
 * Varre até sete dias à frente: uma loja que só abre no domingo, consultada num
 * domingo à noite, tem a próxima abertura no domingo seguinte.
 */
export function nextOpening(
  hours: OpeningHour[],
  now: Moment,
): NextOpening | null {
  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const weekday = (now.weekday + daysAhead) % 7;

    const candidates = hours
      .filter((hour) => hour.weekday === weekday)
      .map((hour) => toMinutes(hour.opens_at))
      // Hoje só valem as aberturas que ainda não passaram. A que já passou ou
      // está em curso não interessa: se estivesse em curso a loja estaria
      // aberta e ninguém teria perguntado.
      .filter((minutes) => daysAhead > 0 || minutes > now.minutes)
      .sort((a, b) => a - b);

    if (candidates.length > 0) {
      return { weekday, minutes: candidates[0], daysAhead };
    }
  }

  return null;
}

/**
 * O texto que o cliente lê. "abre hoje às 18:00" resolve sozinho; "abre segunda
 * às 18:00" obriga a olhar o calendário, então os dois primeiros dias ganham
 * nome próprio.
 */
export function formatOpening(next: NextOpening | null): string | null {
  if (!next) return null;

  const clock = toClock(next.minutes);

  if (next.daysAhead === 0) return `abre hoje às ${clock}`;
  if (next.daysAhead === 1) return `abre amanhã às ${clock}`;

  return `abre ${WEEKDAYS[next.weekday].toLowerCase()} às ${clock}`;
}

/**
 * Tudo junto: dos horários da loja para a frase, ou nulo quando não há o que
 * prometer.
 *
 * `isOpenManual === false` é o lojista tendo fechado na mão, e aí o horário
 * cadastrado não vale — ele volta quando quiser, e anunciar uma hora seria
 * inventar por ele.
 */
export function openingLabel(
  hours: OpeningHour[],
  isOpenManual: boolean | null,
  at: Date = new Date(),
): string | null {
  if (isOpenManual === false) return null;
  return formatOpening(nextOpening(hours, brasiliaNow(at)));
}
