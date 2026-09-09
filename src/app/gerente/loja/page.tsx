import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { HoursEditor } from "./hours-editor";
import { OpenOverride } from "./open-override";
import { StoreForm } from "./store-form";

export const metadata: Metadata = {
  title: "Minha loja",
  robots: { index: false, follow: false },
};

export default async function LojaPage() {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();

  const [storeResult, hoursResult, isOpenResult] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "name, description, whatsapp_e164, address, cep, state_uf, ibge_code, city, neighborhood, cuisine_tags, kind, delivery_fee_cents, free_delivery, delivery_minutes, min_order_cents, is_open_manual",
      )
      .eq("id", session.storeId)
      .single(),
    supabase
      .from("store_hours")
      .select("id, weekday, opens_at, closes_at")
      .eq("store_id", session.storeId)
      .order("weekday")
      .order("opens_at"),
    supabase.rpc("store_is_open", { target: session.storeId }),
  ]);

  const store = storeResult.data;
  if (!store) notFound();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title="Minha loja"
          description="O que o cliente vê antes de abrir o cardápio."
        />
        <StoreForm store={store} />
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">Abrir e fechar</h2>
        <div className="max-w-lg">
          <OpenOverride
            isOpenManual={store.is_open_manual}
            isOpenNow={isOpenResult.data ?? false}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold">Horário de funcionamento</h2>
        <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
          Horário de Brasília.
        </p>
        <HoursEditor hours={hoursResult.data ?? []} />
      </section>
    </div>
  );
}
