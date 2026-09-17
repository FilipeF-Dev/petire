import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { monthlyPriceCents } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { FounderForm } from "../../store-controls";

import { DeleteStore } from "./delete-store";
import { MenuImport } from "./menu-import";
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
    limitResult,
    productsResult,
    ordersResult,
    managerResult,
    paymentsResult,
  ] = await Promise.all([
      supabase
        .from("stores")
        .select(
          "id, slug, name, description, whatsapp_e164, cep, address, city, neighborhood, state_uf, ibge_code, cuisine_tags, kind, delivery_fee_cents, delivery_minutes, min_order_cents, is_active, subscription_until, plan, is_founder, city_slug, neighborhood_slug, published_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("store_slug_history")
        .select("slug, created_at")
        .eq("store_id", id)
        .order("created_at", { ascending: false }),
      // Quanto o plano desta loja permite. Vem da função do banco, e não de uma
      // constante daqui: os números são o botão comercial e moram num lugar só.
      supabase.rpc("store_item_limit", { target: id }),
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

  // Quantas vagas de fundadora restam no bairro desta loja. A função é
  // `security definer` e não está no GRANT de ninguém além do servidor, então
  // ela vem pelo cliente de admin.
  const { data: slotsLeft } = await createAdminClient().rpc(
    "founder_slots_left",
    {
      target_city: store.city_slug ?? "",
      target_neighborhood: store.neighborhood_slug ?? "",
    },
  );

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

      <section className="max-w-lg">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Loja fundadora
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          As primeiras do bairro entram com preço travado e com o teto de itens
          do Plus — o teto existe para o cardápio caber, não para ser vendido.
        </p>
        <div className="mt-3">
          <FounderForm
            storeId={store.id}
            isFounder={store.is_founder}
            slotsLeft={slotsLeft ?? null}
          />
        </div>
        {store.published_at ? (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            No ar desde{" "}
            {new Date(store.published_at).toLocaleDateString("pt-BR")} — é daqui
            que o teste conta.
          </p>
        ) : (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Ainda não entrou no ar. O teste só começa a contar na publicação.
          </p>
        )}
      </section>

      {/*
        A `key` é o preço. Marcar a loja como fundadora revalida a página, mas
        o formulário não remonta — e `defaultValue` de campo não-controlado
        ignora valor novo depois de montado. Sem isto, quem acabou de marcar a
        fundadora registraria o primeiro pagamento com R$ 49 na tela, que é
        exatamente a sequência que o admin faz.
      */}
      <Payments
        key={monthlyPriceCents({
          plan: store.plan,
          isFounder: store.is_founder,
        })}
        storeId={store.id}
        suggestedUntil={nextDueDate(store.subscription_until)}
        priceCents={monthlyPriceCents({
          plan: store.plan,
          isFounder: store.is_founder,
        })}
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

      {/*
        O colar de cardápio fica antes do apagar, e depois do resto: é a ação
        que o suporte faz com frequência numa loja nova, e a de apagar é a que
        ele quase nunca faz.
      */}
      <MenuImport
        storeId={store.id}
        espaco={{
          usados: productsResult.count ?? 0,
          teto: limitResult.data ?? 0,
        }}
      />

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
