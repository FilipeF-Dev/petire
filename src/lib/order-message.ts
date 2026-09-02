import { formatCents } from "./money";

export type OrderOption = {
  groupName: string;
  name: string;
  priceDeltaCents: number;
};

export type OrderLine = {
  name: string;
  quantity: number;
  totalCents: number;
  options: OrderOption[];
  note: string | null;
};

export type Order = {
  storeName: string;
  lines: OrderLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

/**
 * O `wa.me` carrega a mensagem na query string. O limite prático de URL fica
 * perto de 2000 caracteres e estourar não dá erro — o WhatsApp simplesmente
 * abre com o texto cortado no meio, e o lojista recebe meio pedido.
 *
 * Então o texto é montado em três níveis de detalhe e usamos o mais rico que
 * couber.
 */
const MAX_TEXT_LENGTH = 1500;

type Detail = "full" | "no-options" | "compact";

function renderLine(line: OrderLine, detail: Detail): string {
  const head = `${line.quantity}x ${line.name} — ${formatCents(line.totalCents)}`;
  if (detail !== "full") return head;

  const extras = line.options.map(
    (option) => `   • ${option.groupName}: ${option.name}`,
  );
  if (line.note) extras.push(`   • Obs: ${line.note}`);

  return [head, ...extras].join("\n");
}

function render(order: Order, detail: Detail): string {
  const maxLines = detail === "compact" ? 20 : order.lines.length;
  const shown = order.lines.slice(0, maxLines);
  const hidden = order.lines.length - shown.length;

  const items = shown.map((line) => renderLine(line, detail));
  if (hidden > 0) {
    items.push(`… e mais ${hidden} ${hidden === 1 ? "item" : "itens"}`);
  }

  const totals = [
    `Subtotal: ${formatCents(order.subtotalCents)}`,
    order.deliveryFeeCents > 0
      ? `Entrega: ${formatCents(order.deliveryFeeCents)}`
      : "Entrega: a combinar",
    `*Total: ${formatCents(order.totalCents)}*`,
  ];

  return [
    "*Pedido via Petire*",
    "",
    items.join(detail === "full" ? "\n\n" : "\n"),
    "",
    totals.join("\n"),
    "",
    "Nome:",
    "Endereço:",
    "Pagamento:",
  ].join("\n");
}

export function buildOrderMessage(order: Order): string {
  for (const detail of ["full", "no-options", "compact"] as const) {
    const text = render(order, detail);
    if (text.length <= MAX_TEXT_LENGTH) return text;
  }
  return render(order, "compact").slice(0, MAX_TEXT_LENGTH);
}

/**
 * `whatsappE164` já vem normalizado do banco (só dígitos, com código do país),
 * garantido pelo CHECK de `stores.whatsapp_e164`.
 */
export function whatsappUrl(whatsappE164: string, message: string): string {
  return `https://wa.me/${whatsappE164}?text=${encodeURIComponent(message)}`;
}
