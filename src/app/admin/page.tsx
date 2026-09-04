import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { setStoreActive } from "./actions";
import { DemandSignals } from "./demand";
import { ResetPassword, SubscriptionForm } from "./store-controls";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  trial: "Teste",
  active: "Em dia",
  past_due: "Atrasada",
  suspended: "Suspensa",
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target.getTime() - Date.now()) / 86_400_000);
}

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Leitura passa pelo RLS normal: `manages_store()` devolve true em qualquer
  // loja para quem tem papel de admin, então não é preciso service_role aqui.
  const [storesResult, managersResult, productsResult] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "id, slug, name, city, neighborhood, is_active, subscription_status, subscription_until, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("managers").select("id, store_id, email").eq("role", "manager"),
    supabase.from("products").select("store_id, is_available"),
  ]);

  const stores = storesResult.data ?? [];
  const managers = managersResult.data ?? [];
  const products = productsResult.data ?? [];

  const live = stores.filter(
    (store) => store.is_active && store.subscription_status !== "suspended",
  ).length;

  return (
    <div>
      <PageHeader
        title="Lojas"
        description={`${stores.length} cadastradas · ${live} no ar`}
        action={
          <Link href="/admin/nova-loja">
            <Button>Nova loja</Button>
          </Link>
        }
      />

      {/* Onde abrir o próximo bairro, e quem convidar. Some enquanto não há
          sinal nenhum. */}
      <DemandSignals />

      {stores.length === 0 ? (
        <EmptyState
          title="Nenhuma loja ainda"
          description="Cadastre a primeira loja e entregue as credenciais para o lojista montar o cardápio."
          action={
            <Link href="/admin/nova-loja">
              <Button>Cadastrar loja</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {stores.map((store) => {
            const manager = managers.find((m) => m.store_id === store.id);
            const items = products.filter((p) => p.store_id === store.id);
            const available = items.filter((p) => p.is_available).length;
            const remaining = daysUntil(store.subscription_until);
            const isLive =
              store.is_active && store.subscription_status !== "suspended";

            return (
              <li key={store.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{store.name}</h2>
                        <span
                          className={
                            isLive
                              ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                          }
                        >
                          {isLive ? "no ar" : "fora do ar"}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {STATUS_LABEL[store.subscription_status]}
                          {remaining !== null
                            ? remaining < 0
                              ? ` · venceu há ${-remaining} dias`
                              : ` · ${remaining} dias`
                            : null}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {store.neighborhood}, {store.city} ·{" "}
                        <Link
                          href={`/loja/${store.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          /loja/{store.slug}
                        </Link>
                      </p>

                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {manager?.email ?? "sem gerente vinculado"} ·{" "}
                        {available} de {items.length}{" "}
                        {items.length === 1 ? "item" : "itens"} disponíveis
                      </p>

                      {items.length === 0 ? (
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                          Sem cardápio. Colocar no ar assim atrapalha mais do
                          que ajuda.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Link href={`/admin/loja/${store.id}`}>
                        <Button variant="secondary">Editar</Button>
                      </Link>

                      <form action={setStoreActive}>
                        <input type="hidden" name="storeId" value={store.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(!store.is_active)}
                        />
                        <Button
                          type="submit"
                          variant={store.is_active ? "secondary" : "primary"}
                        >
                          {store.is_active ? "Tirar do ar" : "Colocar no ar"}
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    <SubscriptionForm
                      storeId={store.id}
                      status={store.subscription_status}
                      until={store.subscription_until}
                    />
                    {manager ? <ResetPassword managerId={manager.id} /> : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
