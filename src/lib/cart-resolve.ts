import { openingLabel, type OpeningHour } from "./opening";
import {
  escolhaPadrao,
  taxaDaEscolha,
  type ServiceMode,
} from "./service-mode";
import { priceOf, type Promotion } from "./promotions";

/**
 * A montagem do carrinho, sem tocar no banco.
 *
 * Esta é a parte que decide se uma linha do carrinho sobrevive, quanto ela
 * custa e o que vai escrito na mensagem para a loja. Ela mora aqui, separada
 * da consulta, por um motivo concreto: foi **esta decisão** que apagou o
 * carrinho de clientes em produção.
 *
 * O que aconteceu foi que uma coluna ainda não existia no banco, a consulta
 * falhou, a lista de produtos voltou vazia — e a montagem concluiu, com toda a
 * lógica correta, que todos os itens tinham sumido do cardápio. Quem lê
 * `dropped` apaga do aparelho do cliente. O defeito não estava na consulta:
 * estava em não distinguir "o item não existe mais" de "não consegui
 * perguntar".
 *
 * Consulta é difícil de testar; decisão não é. Por isso a distinção agora vive
 * numa função sem I/O, com teste em cima — ver src/lib/cart-resolve.test.ts.
 */

/** Uma linha como o navegador do cliente guardou: só ids. */
export type CartLine = {
  id: string;
  storeId: string;
  productId: string;
  optionIds: string[];
  quantity: number;
  note: string | null;
};

/**
 * O que a montagem precisa saber de cada loja.
 *
 * Estruturais de propósito: quem chama passa o resultado da consulta, e o
 * TypeScript confere o encaixe sem esta biblioteca depender do formato gerado
 * pelo Supabase.
 */
export type CartStore = {
  id: string;
  slug: string;
  name: string;
  is_open_now: boolean;
  is_open_manual: boolean | null;
  delivery_fee_cents: number;
  min_order_cents: number;
  whatsapp_e164: string;
  service_mode: ServiceMode;
  /** Vai na mensagem quando o pedido é para buscar. */
  address: string | null;
};

export type CatalogProduct = {
  id: string;
  store_id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  is_available: boolean;
  product_option_groups: {
    option_groups: {
      name: string;
      options: {
        id: string;
        name: string;
        price_delta_cents: number;
        is_available: boolean;
      }[];
    };
  }[];
};

export type ResolvedLine = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitCents: number;
  totalCents: number;
  /** Preço de tabela, presente só quando há promoção. */
  originalUnitCents: number | null;
  options: { groupName: string; name: string; priceDeltaCents: number }[];
  /**
   * Os ids das opções que valeram — as que esgotaram já saíram daqui.
   *
   * É o que permite guardar o pedido para repetir depois (ver
   * src/lib/recent-orders.ts) sem ter de reabrir o item e remarcar tudo.
   */
  optionIds: string[];
  note: string | null;
};

export type ResolvedStore = {
  storeId: string;
  slug: string;
  name: string;
  isOpenNow: boolean;
  /**
   * "abre amanhã às 09:00", ou nulo quando não há hora a prometer — loja sem
   * horário cadastrado, ou fechada na mão pelo lojista.
   *
   * Só faz sentido com `isOpenNow` falso. É o que decide se o cliente espera ou
   * procura outra loja; sem isso ele manda a mensagem de madrugada e ninguém
   * responde.
   */
  opensLabel: string | null;
  /** O que a loja faz: entrega, retirada, ou os dois. */
  serviceMode: ServiceMode;
  /** Endereço da loja, para quem vai buscar. */
  address: string | null;
  /**
   * A taxa **cadastrada**, e não a deste pedido.
   *
   * Quem faz a conta é `taxaDaEscolha`, porque numa loja que faz as duas
   * coisas ela só existe depois de o cliente escolher — e ele troca de ideia
   * com o carrinho aberto. `totalCents` abaixo já vem com a escolha padrão
   * aplicada; a tela refaz a conta quando o cliente muda.
   */
  deliveryFeeCents: number;
  minOrderCents: number;
  lines: ResolvedLine[];
  subtotalCents: number;
  totalCents: number;
  meetsMinimum: boolean;
  /**
   * O número, não o link pronto.
   *
   * A mensagem é montada no browser porque leva o endereço do cliente, e esse
   * endereço não tem por que passar pelo servidor do Petire — o destino dele é
   * o WhatsApp da loja.
   */
  whatsappE164: string;
};

export type ResolvedCart = {
  stores: ResolvedStore[];
  /** Ids de linha que sumiram do cardápio ou esgotaram. O cliente limpa do storage. */
  dropped: string[];
  /**
   * O catálogo não pôde ser lido.
   *
   * Diferente de "o item não existe mais", e a diferença é o carrinho do
   * cliente: quando a consulta falha, nada é descartado. Sem esta distinção,
   * qualquer erro de leitura vira "todos os itens sumiram do cardápio" — e o
   * carrinho é apagado de verdade, porque quem lê `dropped` chama `removeLine`.
   */
  failed?: boolean;
};

/** A promoção com a loja junto: o carrinho pode ter itens de mais de uma. */
export type StorePromotion = Promotion & { store_id: string };

export type Catalog = {
  stores: CartStore[];
  products: CatalogProduct[];
  promotions: StorePromotion[];
  /** Horários de todas as lojas do carrinho, para o "abre amanhã às…". */
  hours: (OpeningHour & { store_id: string })[];
};

/**
 * Monta o carrinho a partir das linhas do cliente e do catálogo lido agora.
 *
 * O preço nunca vem do navegador: ele é recalculado aqui, com a promoção que
 * estiver valendo neste instante. Um carrinho de ontem não pode cobrar o preço
 * de ontem na mensagem que chega à loja.
 */
export function assembleCart(
  lines: CartLine[],
  catalog: Catalog,
  now: Date = new Date(),
): { stores: ResolvedStore[]; dropped: string[] } {
  const stores = new Map(catalog.stores.map((store) => [store.id, store]));
  const products = new Map(
    catalog.products.map((product) => [product.id, product]),
  );

  const dropped: string[] = [];
  const byStore = new Map<string, ResolvedLine[]>();

  for (const line of lines) {
    const store = stores.get(line.storeId);
    const product = products.get(line.productId);

    // O produto tem de pertencer à loja que veio na linha: o localStorage é
    // editável, e uma linha adulterada não pode misturar cardápios.
    if (
      !store ||
      !product ||
      product.store_id !== line.storeId ||
      !product.is_available
    ) {
      dropped.push(line.id);
      continue;
    }

    // Os grupos deste item, atravessando a ligação que os compartilha entre
    // vários. O que importa aqui não é a ordem, é o conjunto: uma opção só
    // entra na conta se pertencer a um grupo que **este** item usa.
    const chosen = product.product_option_groups
      .map((link) => link.option_groups)
      .flatMap((group) =>
        group.options
          .filter(
            (option) =>
              line.optionIds.includes(option.id) && option.is_available,
          )
          .map((option) => ({
            id: option.id,
            groupName: group.name,
            name: option.name,
            priceDeltaCents: option.price_delta_cents,
          })),
      );

    const storePromotions = catalog.promotions.filter(
      (promotion) => promotion.store_id === line.storeId,
    );

    const base = priceOf(product.price_cents, product.id, storePromotions, now);
    const extras = chosen.reduce(
      (total, option) => total + option.priceDeltaCents,
      0,
    );

    const unitCents = Math.max(0, base.cents + extras);

    byStore.set(line.storeId, [
      ...(byStore.get(line.storeId) ?? []),
      {
        id: line.id,
        productId: product.id,
        name: product.name,
        imageUrl: product.image_url,
        quantity: line.quantity,
        unitCents,
        totalCents: unitCents * line.quantity,
        originalUnitCents:
          base.originalCents === null ? null : base.originalCents + extras,
        options: chosen.map(({ groupName, name, priceDeltaCents }) => ({
          groupName,
          name,
          priceDeltaCents,
        })),
        optionIds: chosen.map((option) => option.id),
        note: line.note,
      },
    ]);
  }

  const resolved: ResolvedStore[] = [];

  for (const [storeId, storeLines] of byStore) {
    const store = stores.get(storeId)!;
    const subtotalCents = storeLines.reduce(
      (total, line) => total + line.totalCents,
      0,
    );

    const hours: OpeningHour[] = catalog.hours
      .filter((hour) => hour.store_id === storeId)
      .map((hour) => ({ weekday: hour.weekday, opens_at: hour.opens_at }));

    resolved.push({
      storeId,
      slug: store.slug,
      name: store.name,
      isOpenNow: store.is_open_now,
      opensLabel: store.is_open_now
        ? null
        : openingLabel(hours, store.is_open_manual, now),
      serviceMode: store.service_mode,
      address: store.address,
      deliveryFeeCents: store.delivery_fee_cents,
      minOrderCents: store.min_order_cents,
      lines: storeLines,
      subtotalCents,
      totalCents:
        subtotalCents +
        taxaDaEscolha(
          escolhaPadrao(store.service_mode),
          store.delivery_fee_cents,
        ),
      meetsMinimum: subtotalCents >= store.min_order_cents,
      whatsappE164: store.whatsapp_e164,
    });
  }

  resolved.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { stores: resolved, dropped };
}
