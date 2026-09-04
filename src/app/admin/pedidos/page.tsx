import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { ApplicationCard, type Application } from "./application-card";

export const metadata: Metadata = {
  title: "Pedidos de cadastro",
  robots: { index: false, follow: false },
};

/**
 * A fila de lojas que se candidataram sozinhas.
 *
 * Lida com service_role: `store_applications` tem RLS ligada e nenhuma policy,
 * porque a fila carrega e-mail e telefone de quem se candidatou.
 *
 * O trabalho do admin aqui é conferir, não digitar — e a conferência que
 * importa é uma só: o WhatsApp recebe pedido mesmo? O número errado é o defeito
 * mais caro do Petire.
 */
export default async function PedidosPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data } = await admin
    .from("store_applications")
    .select(
      "id, store_name, manager_email, whatsapp_e164, cep, address, city, neighborhood, state_uf, kind, note, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const applications = (data ?? []) as Application[];

  return (
    <div>
      <PageHeader
        title="Pedidos de cadastro"
        description={
          applications.length === 0
            ? "Nada na fila."
            : `${applications.length} ${applications.length === 1 ? "loja esperando" : "lojas esperando"} · as mais antigas primeiro`
        }
      />

      {applications.length === 0 ? (
        <EmptyState
          title="Fila vazia"
          description="Quando um lojista se cadastrar por /cadastrar, o pedido aparece aqui para você conferir e aprovar."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => (
            <li key={application.id}>
              <ApplicationCard application={application} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
