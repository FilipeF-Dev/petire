import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import {
  discountLabel,
  endsAtToDay,
  promotionStatus,
  startsAtToDay,
  type PromotionStatus,
} from "@/lib/promotions";
import { createClient } from "@/lib/supabase/server";

import { setPromotionActive } from "./actions";

export const metadata: Metadata = {
  title: "Promoções",
  robots: { index: false, follow: false },
};

type PromotionRow = {
  id: string;
  product_id: string | null;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
};

const STATUS_CLASS: Record<PromotionStatus, string> = {
  ativa:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  agendada:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  encerrada:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  pausada:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

/** "2026-09-30" → "30/09/26". Fatiar a string evita o fuso do `new Date`. */
function shortDay(day: string): string {
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year.slice(2)}`;
}

function windowLabel(promotion: PromotionRow): string {
  const start = shortDay(startsAtToDay(promotion.starts_at));
  const end = promotion.ends_at ? shortDay(endsAtToDay(promotion.ends_at)) : null;

  return end ? `${start} até ${end}` : `desde ${start}, sem prazo`;
}

export default async function PromocoesPage() {
  const session = await requireManager();

  if (!session.storeId) {
    return <p className="text-sm">Sua conta não está vinculada a uma loja.</p>;
  }

  const supabase = await createClient();

  // Os nomes dos produtos são casados aqui em vez de num embed do PostgREST:
  // a FK de promotions para products é composta (product_id, store_id) e o
  // relacionamento não é o caminho óbvio para quem lê a consulta.
  const [promotionsResult, productsResult] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, product_id, kind, value, starts_at, ends_at, is_active")
      .eq("store_id", session.storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name")
      .eq("store_id", session.storeId)
      .order("sort_order")
      .order("created_at"),
  ]);

  const promotions = (promotionsResult.data ?? []) as PromotionRow[];
  const products = productsResult.data ?? [];
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Promoções"
        description="Desconto por item ou no cardápio todo, com prazo."
        action={
          <Link href="/gerente/promocoes/nova">
            <Button>Nova promoção</Button>
          </Link>
        }
      />

      {promotions.length === 0 ? (
        <EmptyState
          title="Nenhuma promoção"
          description="O desconto vira selo no cardápio e já sai abatido no pedido."
          action={
            <Link href="/gerente/promocoes/nova">
              <Button>Criar primeira promoção</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <ul>
            {promotions.map((promotion) => {
              const status = promotionStatus(promotion, now);

              return (
                <li
                  key={promotion.id}
                  className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3 first:border-t-0 dark:border-neutral-800"
                >
                  <Link
                    href={`/gerente/promocoes/${promotion.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {discountLabel(promotion.kind, promotion.value)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {promotion.product_id
                        ? (productName.get(promotion.product_id) ??
                          "item apagado")
                        : "todo o cardápio"}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {windowLabel(promotion)}
                    </p>
                  </Link>

                  <form action={setPromotionActive} className="shrink-0">
                    <input
                      type="hidden"
                      name="promotionId"
                      value={promotion.id}
                    />
                    <input
                      type="hidden"
                      name="isActive"
                      value={promotion.is_active ? "false" : "true"}
                    />
                    <Button type="submit" variant="secondary">
                      {promotion.is_active ? "Pausar" : "Retomar"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-4 max-w-lg text-xs text-neutral-500 dark:text-neutral-400">
        Promoção de item ganha da do cardápio inteiro. Os descontos nunca se
        somam.
      </p>
    </div>
  );
}
