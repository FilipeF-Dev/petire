/**
 * A mensalidade, do jeito que as duas pontas leem.
 *
 * O painel do lojista mostrava o status cru do banco — "trial", "past_due" —
 * que é vocabulário de schema, não de quem está atrás do balcão. E mostrava a
 * data sem dizer o que ela significa: "até 02/12/2026" não avisa nada a quem
 * vence amanhã.
 *
 * Os rótulos moram aqui porque o admin e o painel do lojista precisam dizer a
 * mesma coisa sobre a mesma loja. Duas cópias divergiriam na primeira vez que
 * um status novo aparecesse.
 */

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended";

export const STATUS_LABEL: Record<string, string> = {
  trial: "Teste",
  active: "Em dia",
  past_due: "Atrasada",
  suspended: "Suspensa",
};

/** Quantos dias faltam para a data. Negativo quando já passou. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  // Meio-dia para o arredondamento não escorregar com o fuso: a data do banco
  // é um `date`, sem hora, e `new Date("2026-12-02")` é meia-noite em UTC.
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target.getTime() - Date.now()) / 86_400_000);
}

/** A partir de quantos dias o lojista precisa ser avisado. */
const WARN_DAYS = 5;

export type SubscriptionNotice = {
  tone: "calm" | "warn" | "alert";
  title: string;
  hint: string;
};

/**
 * O que dizer ao lojista sobre a própria assinatura.
 *
 * Avisar antes é o ponto: quem descobre que venceu porque a loja sumiu do
 * catálogo já perdeu os pedidos do dia, e a conversa começa com ele irritado.
 */
export function subscriptionNotice(
  status: string,
  until: string | null,
): SubscriptionNotice {
  const remaining = daysUntil(until);
  const label = STATUS_LABEL[status] ?? status;

  if (status === "suspended") {
    return {
      tone: "alert",
      title: "Assinatura suspensa",
      hint: "Sua loja saiu do catálogo. Fale com o Petire para voltar.",
    };
  }

  if (status === "past_due" || (remaining !== null && remaining < 0)) {
    const late = remaining === null ? null : -remaining;
    return {
      tone: "alert",
      title:
        late === null
          ? "Mensalidade atrasada"
          : `Mensalidade atrasada há ${late} ${late === 1 ? "dia" : "dias"}`,
      // Carência: a loja continua no ar em past_due, e dizer isso evita o
      // susto de achar que já saiu.
      hint: "Sua loja continua no ar por enquanto. Mande o comprovante para o Petire.",
    };
  }

  if (remaining !== null && remaining <= WARN_DAYS) {
    return {
      tone: "warn",
      title:
        remaining === 0
          ? "Vence hoje"
          : `Vence em ${remaining} ${remaining === 1 ? "dia" : "dias"}`,
      hint:
        status === "trial"
          ? "Seu período gratuito está acabando. Fale com o Petire para continuar."
          : "Mande o comprovante para o Petire assim que pagar.",
    };
  }

  return {
    tone: "calm",
    title: status === "trial" ? "Período gratuito" : label,
    hint:
      remaining === null
        ? "Sem data de vencimento cadastrada."
        : `Faltam ${remaining} dias.`,
  };
}
