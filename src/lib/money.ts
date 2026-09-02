/**
 * Dinheiro no Petire é sempre INTEGER em centavos, do banco até a tela.
 * Estas são as únicas funções que fazem a conversão.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 2490 → "R$ 24,90" */
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/** "24,90" ou "R$ 24,90" ou "24.90" → 2490. Devolve null se não der para ler. */
export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 100);
}
