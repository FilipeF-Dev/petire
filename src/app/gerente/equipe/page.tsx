import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { PlanLocked } from "../plan-locked";
import { TeamManager, type TeamMember } from "./team-manager";

export const metadata: Metadata = {
  title: "Equipe",
  robots: { index: false, follow: false },
};

/**
 * Os acessos da loja.
 *
 * Um login por loja significa senha compartilhada por WhatsApp entre os sócios
 * e quem está no caixa — e ninguém sabendo quem mudou o preço. É um problema
 * pequeno na loja de uma pessoa e real na de três.
 *
 * O teto vem do banco (`store_manager_limit`), não daqui: a tela mostra o que o
 * plano permite, mas quem garante é a checagem na action.
 */
export default async function EquipePage() {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();

  const [store, membersResult, limitResult] = await Promise.all([
    supabase
      .from("stores")
      .select("plan")
      .eq("id", session.storeId)
      .maybeSingle(),
    supabase
      .from("managers")
      .select("id, email")
      .eq("store_id", session.storeId)
      .eq("role", "manager")
      .order("created_at"),
    supabase.rpc("store_manager_limit", { target: session.storeId }),
  ]);

  const limit = limitResult.data ?? 1;
  const members = (membersResult.data ?? []) as TeamMember[];

  return (
    <div>
      <PageHeader
        title="Equipe"
        description={`${members.length} de ${limit} ${limit === 1 ? "acesso" : "acessos"} em uso.`}
      />

      {store.data?.plan === "plus" ? (
        <TeamManager
          members={members}
          currentUserId={session.userId}
          limit={limit}
        />
      ) : (
        <PlanLocked
          title="Mais de um acesso é do plano Plus"
          description="Hoje sua loja tem um login só, compartilhado. Com o Plus, cada sócio ou funcionário entra com o próprio e-mail — e você tira o acesso de quem sair, sem trocar a senha de todo mundo."
        >
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {members.map((member) => (
              <li key={member.id} className="text-neutral-600 dark:text-neutral-400">
                {member.email}
                {member.id === session.userId ? " · você" : null}
              </li>
            ))}
          </ul>
        </PlanLocked>
      )}
    </div>
  );
}
