import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DeleteStore } from "./delete-store";
import { EditStoreForm } from "./edit-store-form";
import { ManagerAccess } from "./manager-access";
import { Payments } from "./payments";

/** Um mês à frente do vencimento atual, ou de hoje se não houver. */
function nextDueDate(until: string | null): string {
  const base = until ? new Date(`${until}T12:00:00`) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export const metadata: Metadata = {
  title: "Editar loja",
  robots: { index: false, follow: false },
};

export default async function EditarLojaPage({
  params,
}: PageProps<"/admin/loja/[id]">) {
  const { id } = await params;
  await requireAdmin();

  const supabase = await createClient();

  // Leitura pelo RLS normal: manages_store() é true em qualquer loja para o
  // papel de admin. Só a escrita precisa de service_role.
  const [
    storeResult,
    historyResult,
    productsResult,
    ordersResult,
    managerResult,
    paymentsResult,
  ] = await Promise.all([
      supabase
        .from("stores")
        .select(
          "id, slug, name, description, whatsapp_e164, cep, address, city, neighborhood, state_uf, ibge_code, cuisine_tags, kind, delivery_fee_cents, delivery_minutes, min_order_cents, is_active, subscription_until",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("store_slug_history")
        .select("slug, created_at")
        .eq("store_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", id),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("store_id", id)
        .eq("kind", "whatsapp_click"),
      supabase
        .from("managers")
        .select("id, email")
        .eq("store_id", id)
        .eq("role", "manager")
        .maybeSingle(),
      supabase
        .from("subscription_payments")
        .select("id, amount_cents, paid_on, covers_until, note")
        .eq("store_id", id)
        .order("paid_on", { ascending: false })
        .limit(12),
    ]);

  const store = storeResult.data;
  if (!store) notFound();

  const history = historyResult.data ?? [];
  const manager = managerResult.data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader
          title={store.name}
          description="Dados que o cliente vê. O cardápio quem monta é o lojista."
        />
        <EditStoreForm store={store} />
      </div>

      {manager ? (
        <ManagerAccess managerId={manager.id} email={manager.email} />
      ) : (
        <p className="max-w-lg rounded-xl border border-amber-300 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:text-amber-300">
          Esta loja não tem gerente vinculado, então ninguém consegue montar o
          cardápio dela.
        </p>
      )}

      <Payments
        storeId={store.id}
        suggestedUntil={nextDueDate(store.subscription_until)}
        payments={paymentsResult.data ?? []}
      />

      {history.length > 0 ? (
        <section className="max-w-lg">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Apelidos antigos
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Continuam respondendo e redirecionam para o apelido atual.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {history.map((entry) => (
              <li
                key={entry.slug}
                className="text-sm text-neutral-500 dark:text-neutral-400"
              >
                <code>/loja/{entry.slug}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeleteStore
        storeId={store.id}
        slug={store.slug}
        counts={{
          products: productsResult.count ?? 0,
          orders: ordersResult.count ?? 0,
        }}
      />
    </div>
  );
}
