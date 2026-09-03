import { formatCents, formatDeliveryFee } from "./money";

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

/**
 * Endereço do cliente, vindo do CEP que ele informou.
 *
 * Vem do localStorage dele e é montado no browser — não passa pelo servidor
 * do Petire em momento nenhum. O destino é o WhatsApp da loja, que é quem
 * precisa entregar.
 */
export type Delivery = {
  /** Só dígitos. Vazio quando o cliente não informou o CEP. */
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  /** Quem vai receber, informado na hora de fechar o pedido. */
  recipient: string;
  /** Número da residência. */
  number: string;
  /** Apartamento, bloco, referência. Pode ser vazio. */
  complement: string;
};

export type Order = {
  storeName: string;
  lines: OrderLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  delivery?: Delivery | null;
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
    `Entrega: ${formatDeliveryFee(order.deliveryFeeCents)}`,
    `*Total: ${formatCents(order.totalCents)}*`,
  ];

  return [
    "*Pedido via Petire*",
    "",
    items.join(detail === "full" ? "\n\n" : "\n"),
    "",
    totals.join("\n"),
    "",
    ...deliveryBlock(order.delivery),
  ].join("\n");
}

/**
 * Para onde vai e para quem.
 *
 * Nada fica em aberto: o cliente responde nome, número e complemento na tela
 * antes de sair, e o resto vem do CEP. Uma linha "Endereço:" vazia obrigava a
 * loja a perguntar e o cliente a digitar no meio da conversa, que é onde o
 * pedido esfria.
 *
 * Pagamento não entra: quem cobra é a loja, e ela pergunta do jeito dela — o
 * Petire não vê dinheiro nenhum e não deveria dar a entender que vê.
 */
function deliveryBlock(delivery: Delivery | null | undefined): string[] {
  if (!delivery) {
    return ["Nome:", "Endereço:", "Complemento:"];
  }

  const lines: string[] = [];

  lines.push(delivery.recipient ? `Nome: ${delivery.recipient}` : "Nome:");

  // Sem logradouro em cidade de CEP único; aí só o número é o que se tem.
  const street = [delivery.street, delivery.number && `nº ${delivery.number}`]
    .filter(Boolean)
    .join(", ");
  lines.push(street ? `Endereço: ${street}` : "Endereço:");

  if (delivery.complement) {
    lines.push(`Complemento: ${delivery.complement}`);
  }

  if (delivery.cep) {
    const cep =
      delivery.cep.length === 8
        ? `${delivery.cep.slice(0, 5)}-${delivery.cep.slice(5)}`
        : delivery.cep;

    const place = [delivery.neighborhood, `${delivery.city}/${delivery.uf}`]
      .filter(Boolean)
      .join(" · ");

    lines.push(`Bairro: ${place} · CEP ${cep}`);
  }

  return lines;
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
