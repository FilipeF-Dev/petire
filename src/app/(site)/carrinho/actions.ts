"use server";

import { z } from "zod";

import {
  assembleCart,
  type CartStore,
  type ResolvedCart,
  type StorePromotion,
} from "@/lib/cart-resolve";

import { CARD_SELECT, viewRows } from "@/lib/storefront";

export type {
  ResolvedCart,
  ResolvedLine,
  ResolvedStore,
} from "@/lib/cart-resolve";
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

export async function resolveCart(input: unknown): Promise<ResolvedCart> {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { stores: [], dropped: [] };

  const lines = parsed.data;
  if (lines.length === 0) return { stores: [], dropped: [] };

  const supabase = createPublicClient();
  const storeIds = [...new Set(lines.map((line) => line.storeId))];
  const productIds = [...new Set(lines.map((line) => line.productId))];

  const [storesResult, productsResult, promotionsResult, hoursResult] =
    await Promise.all([
      // stores_public só devolve loja ativa e não suspensa — uma loja que saiu
      // do ar some do carrinho junto.
      supabase
        .from("stores_public")
        .select(`${CARD_SELECT}, whatsapp_e164, is_open_manual`)
        .in("id", storeIds),
      supabase
        .from("products")
        .select(
          "id, store_id, name, price_cents, image_url, is_available, product_option_groups(option_groups(id, name, options(id, name, price_delta_cents, is_available)))",
        )
        .in("id", productIds),
      supabase
        .from("promotions")
        .select(
          "store_id, product_id, kind, value, starts_at, ends_at, weekdays",
        )
        .in("store_id", storeIds)
        .eq("is_active", true),
      // Para responder "e quando abre?" à loja que está fechada agora.
      supabase
        .from("store_hours")
        .select("store_id, weekday, opens_at")
        .in("store_id", storeIds),
    ]);

  /**
   * Consulta que falhou não é item que sumiu.
   *
   * Estas três decidem se uma linha sobrevive: sem loja e sem produto não há o
   * que montar, e sem as promoções o preço sairia pelo valor de tabela — mais
   * caro do que o cliente viu no cardápio, na mensagem que vai para a loja.
   *
   * Sem esta parada, qualquer erro aqui — uma coluna que ainda não existe no
   * banco de produção, o Supabase fora do ar por um minuto — descartava todas
   * as linhas, e o carrinho do cliente era apagado do aparelho dele.
   *
   * `hoursResult` fica de fora de propósito: ele só alimenta o "abre amanhã às
   * 09:00". Perder a frase é aceitável; perder o pedido, não.
   */
  if (storesResult.error || productsResult.error || promotionsResult.error) {
    return { stores: [], dropped: [], failed: true };
  }

  const { stores, dropped } = assembleCart(lines, {
    stores: viewRows<CartStore>(storesResult.data),
    products: productsResult.data ?? [],
    promotions: (promotionsResult.data ?? []) as StorePromotion[],
    hours: hoursResult.data ?? [],
  });

  return { stores, dropped };
}
