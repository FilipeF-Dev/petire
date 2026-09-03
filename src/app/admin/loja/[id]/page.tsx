import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { EditStoreForm } from "./edit-store-form";

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
  const [storeResult, historyResult] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "id, slug, name, description, whatsapp_e164, cep, address, city, neighborhood, state_uf, ibge_code, cuisine_tags, kind, delivery_fee_cents, min_order_cents, is_active",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("store_slug_history")
      .select("slug, created_at")
      .eq("store_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const store = storeResult.data;
  if (!store) notFound();

  const history = historyResult.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader
          title={store.name}
          description="Dados que o cliente vê. O cardápio quem monta é o lojista."
        />
        <EditStoreForm store={store} />
      </div>

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
    </div>
  );
}
