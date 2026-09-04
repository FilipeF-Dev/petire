"use server";

import { z } from "zod";

import { openingLabel, type OpeningHour } from "@/lib/opening";
import { priceOf, type Promotion } from "@/lib/promotions";
import { CARD_SELECT, viewRows, type PublicStoreCard } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reconstrói o carrinho a partir do banco.
 *
 * O localStorage guarda só ids. Preço, disponibilidade, taxa de entrega e
 * número de WhatsApp são lidos agora — um carrinho de ontem não pode cobrar o
 * preço de ontem nem mandar o pedido para um número que a loja já trocou.
 *
 * Por isso o cálculo mora aqui e não no browser: é a mesma conta que monta a
 * mensagem enviada à loja.
 */

const lineSchema = z.object({
  id: z.string().min(1).max(400),
  storeId: z.uuid(),
  productId: z.uuid(),
  optionIds: z.array(z.uuid()).max(20),
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(200).nullable(),
});

const cartSchema = z.array(lineSchema).max(100);

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
};

export async function resolveCart(input: unknown): Promise<ResolvedCart> {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { stores: [], dropped: [] };

  const lines = parsed.data;
  if (lines.length === 0) return { stores: [], dropped: [] };

  const supabase = createPublicClient();
  const storeIds = [...new Set(lines.map((line) => line.storeId))];
  const productIds = [...new Set(lines.map((line) => line.productId))];

  const [storesResult, productsResult, promotionsResult, hoursResult] = await Promise.all([
    // stores_public só devolve loja ativa e não suspensa — uma loja que saiu
    // do ar some do carrinho junto.
    supabase
      .from("stores_public")
      .select(`${CARD_SELECT}, whatsapp_e164, is_open_manual`)
      .in("id", storeIds),
    supabase
      .from("products")
      .select(
        "id, store_id, name, price_cents, image_url, is_available, option_groups(id, name, options(id, name, price_delta_cents, is_available))",
      )
      .in("id", productIds),
    supabase
      .from("promotions")
      .select("store_id, product_id, kind, value, starts_at, ends_at")
      .in("store_id", storeIds)
      .eq("is_active", true),
    // Para responder "e quando abre?" à loja que está fechada agora.
    supabase
      .from("store_hours")
      .select("store_id, weekday, opens_at")
      .in("store_id", storeIds),
  ]);

  const stores = new Map(
    viewRows<
      PublicStoreCard & { whatsapp_e164: string; is_open_manual: boolean | null }
    >(storesResult.data).map((store) => [store.id, store]),
  );
  const products = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
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

    const chosen = product.option_groups.flatMap((group) =>
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

    const storePromotions = (promotionsResult.data ?? []).filter(
      (promotion) => promotion.store_id === line.storeId,
    ) as Promotion[];

    const base = priceOf(product.price_cents, product.id, storePromotions);
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
    const totalCents = subtotalCents + store.delivery_fee_cents;

    const hours: OpeningHour[] = (hoursResult.data ?? [])
      .filter((hour) => hour.store_id === storeId)
      .map((hour) => ({ weekday: hour.weekday, opens_at: hour.opens_at }));

    resolved.push({
      storeId,
      slug: store.slug,
      name: store.name,
      isOpenNow: store.is_open_now,
      opensLabel: store.is_open_now
        ? null
        : openingLabel(hours, store.is_open_manual),
      deliveryFeeCents: store.delivery_fee_cents,
      minOrderCents: store.min_order_cents,
      lines: storeLines,
      subtotalCents,
      totalCents,
      meetsMinimum: subtotalCents >= store.min_order_cents,
      whatsappE164: store.whatsapp_e164,
    });
  }

  resolved.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { stores: resolved, dropped };
}
