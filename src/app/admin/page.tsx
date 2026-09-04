import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { daysSince, lastEditedAt, STALE_DAYS } from "@/lib/freshness";
import { daysUntil, STATUS_LABEL } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { setStoreActive } from "./actions";
import { DemandSignals } from "./demand";
import { PlanForm, ResetPassword, SubscriptionForm } from "./store-controls";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Os rótulos e a conta de dias moram em src/lib/subscription.ts: o admin e o
// painel do lojista precisam dizer a mesma coisa sobre a mesma loja.

// A régua do cardápio parado mora em src/lib/freshness.ts: o admin vê para
// saber com quem falar, e o lojista vê para agir antes de alguém precisar
// falar com ele — os dois lados medem a mesma coisa.

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Leitura passa pelo RLS normal: `manages_store()` devolve true em qualquer
  // loja para quem tem papel de admin, então não é preciso service_role aqui.
  const [storesResult, managersResult, productsResult] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "id, slug, name, city, neighborhood, is_active, plan, subscription_status, subscription_until, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("managers").select("id, store_id, email").eq("role", "manager"),
    // updated_at alimenta o sinal de frescor: cardápio parado é o risco número
    // dois do próprio MVP, e até aqui nada envelhecia sozinho.
    supabase.from("products").select("store_id, is_available, updated_at"),
  ]);

  // A fila mora atrás de service_role: `store_applications` não tem policy,
  // porque carrega e-mail e telefone de quem se candidatou.
  const { count: pendingCount } = await createAdminClient()
    .from("store_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const pending = pendingCount ?? 0;
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
          <div className="flex flex-wrap items-center gap-2">
            {/* A fila só aparece quando tem gente nela: um link permanente
                marcando zero ensina a não olhar. */}
            {pending > 0 ? (
              <Link href="/admin/pedidos">
                <Button variant="secondary">
                  {pending} {pending === 1 ? "pedido" : "pedidos"} na fila
                </Button>
              </Link>
            ) : null}
            <Link href="/admin/nova-loja">
              <Button>Nova loja</Button>
            </Link>
          </div>
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
            const stale = daysSince(lastEditedAt(items));
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
                      ) : stale !== null && stale >= STALE_DAYS ? (
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                          Cardápio parado há {stale} dias. Vale conferir se
                          preço e horário ainda valem.
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
                    <PlanForm storeId={store.id} plan={store.plan} />
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
