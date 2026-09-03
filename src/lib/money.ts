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

/**
 * Taxa de entrega, do jeito que pode ser mostrada ao cliente.
 *
 * Zero **não** é "grátis". A taxa nasce zerada no cadastro e o formulário de
 * criação nem pergunta por ela, então zero quase sempre quer dizer "o lojista
 * ainda não informou" — e anunciar entrega grátis em nome dele é prometer o
 * que ele não prometeu. Quem entrega de graça combina isso no WhatsApp, que é
 * onde o pedido fecha.
 */
export function formatDeliveryFee(cents: number): string {
  return cents > 0 ? formatCents(cents) : "a combinar";
}

/** "24,90" ou "R$ 24,90" ou "24.90" → 2490. Devolve null se não der para ler. */
export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 100);
}
