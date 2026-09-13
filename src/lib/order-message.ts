import { formatCents, formatDeliveryFee } from "./money";
import type { Escolha } from "./service-mode";

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
  /**
   * A página da loja no Petire.
   *
   * É o único caminho de volta que existe. Sem cadastro, o Petire some da vida
   * do cliente no instante em que ele sai para o WhatsApp — mas esta mensagem
   * fica na conversa dele com a loja, que é exatamente onde ele procura quando
   * quer pedir de novo.
   */
  storeUrl?: string | null;
  lines: OrderLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  delivery?: Delivery | null;
  /**
   * Como este pedido vai sair da loja.
   *
   * Ausente é entrega, que é o que toda loja fazia quando esta mensagem foi
   * escrita — o padrão mantém intactas as chamadas que não sabem do assunto.
   */
  escolha?: Escolha;
  /**
   * O endereço **da loja**, para a mensagem de retirada.
   *
   * Quem vai buscar precisa saber onde. Vai escrito na mensagem, e não só na
   * página, porque é a mensagem que fica na conversa do cliente — é ali que
   * ele procura o endereço quando está saindo de casa.
   */
  storeAddress?: string | null;
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

  const retirada = order.escolha === "pickup";

  /*
    Na retirada não existe linha de entrega. "Entrega: grátis" seria o site
    prometendo, no nome da loja, um serviço que ela não faz — e é justamente o
    mal-entendido que este modo veio resolver.
  */
  const totals = retirada
    ? [
        `Subtotal: ${formatCents(order.subtotalCents)}`,
        `*Total: ${formatCents(order.totalCents)}*`,
      ]
    : [
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
    ...(retirada
      ? pickupBlock(order.delivery, order.storeAddress)
      : deliveryBlock(order.delivery)),
    ...backLink(order.storeUrl),
  ].join("\n");
}

/**
 * O caminho de volta, no rodapé.
 *
 * Sem o "https://": o WhatsApp linka o domínio sozinho e o texto fica mais
 * curto de ler. Fica por último de propósito — se um pedido enorme ainda
 * estourar o limite depois dos três níveis de detalhe, o que se perde no corte
 * é o link, nunca o endereço da entrega.
 */
function backLink(storeUrl: string | null | undefined): string[] {
  if (!storeUrl) return [];
  return ["", `Pedir de novo: ${storeUrl.replace(/^https?:\/\//, "")}`];
}

/**
 * O pedido que o cliente busca.
 *
 * O que a loja precisa saber muda de lado: não é para onde levar, é quem vem
 * buscar — o nome com que ela vai chamar no balcão. E o endereço que vai na
 * mensagem é o **dela**, para o cliente ter na mão na hora de sair.
 */
function pickupBlock(
  delivery: Delivery | null | undefined,
  storeAddress: string | null | undefined,
): string[] {
  const lines = ["*Retirada no balcão*"];

  lines.push(delivery?.recipient ? `Nome: ${delivery.recipient}` : "Nome:");
  if (storeAddress) lines.push(`Endereço da loja: ${storeAddress}`);

  return lines;
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
