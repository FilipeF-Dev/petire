import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function GerentePage() {
  const session = await requireManager();

  // Admin não tem loja, então não há painel de lojista para mostrar.
  if (!session.storeId) {
    redirect("/admin");
  }

  const supabase = await createClient();

  const [store, products, metrics, isOpen] = await Promise.all([
    supabase
      .from("stores")
      .select("name, slug, neighborhood, city, delivery_fee_cents, subscription_status, subscription_until, is_active")
      .eq("id", session.storeId)
      .single(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId)
      .eq("is_available", true),
    supabase.rpc("store_metrics", { target: session.storeId }),
    supabase.rpc("store_is_open", { target: session.storeId }),
  ]);

  const counts = metrics.data?.[0];

  if (store.error || !store.data) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Não foi possível carregar a loja: {store.error?.message ?? "não encontrada"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {store.data.name}
          </h1>
          <span
            className={
              isOpen.data
                ? "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
            }
          >
            {isOpen.data ? "Aberta agora" : "Fechada"}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {store.data.neighborhood}, {store.data.city} · /loja/{store.data.slug}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Pedidos enviados"
          value={String(counts?.whatsapp_clicks ?? 0)}
          hint="últimos 30 dias"
        />
        <Stat
          label="Visitas ao cardápio"
          value={String(counts?.store_views ?? 0)}
          hint="últimos 30 dias"
        />
        <Stat
          label="Itens disponíveis"
          value={String(products.count ?? 0)}
          hint={`entrega ${formatCents(store.data.delivery_fee_cents)}`}
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-surface p-4 text-sm dark:border-neutral-800">
        <p className="font-medium">Assinatura</p>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {store.data.subscription_status}
          {store.data.subscription_until
            ? ` · até ${new Date(store.data.subscription_until).toLocaleDateString("pt-BR")}`
            : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/gerente/cardapio">
          <Button>Editar cardápio</Button>
        </Link>
        <Link href="/gerente/loja">
          <Button variant="secondary">Dados da loja</Button>
        </Link>
      </div>
    </div>
  );
}
