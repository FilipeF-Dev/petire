"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  teamInviteSchema,
  toFormState,
  type FormState,
} from "@/lib/validation";

/**
 * Contas de acesso da loja.
 *
 * Até aqui era um login por loja, compartilhado entre os sócios e quem está no
 * caixa — o que significa senha passada por WhatsApp e ninguém sabendo quem
 * mudou o quê. O plano com equipe resolve isso.
 *
 * O teto vem de `store_manager_limit()`, no banco, e não de uma constante daqui:
 * assim ele vale mesmo se amanhã alguém escrever outra tela que crie gerente.
 */

export type InviteState = FormState & {
  created?: { email: string; password: string };
};

/** Senha inicial legível, para ser passada por telefone sem soletrar hex. */
function initialPassword(): string {
  const words = ["pao", "mesa", "gelo", "forno", "balcao", "copo", "brasa"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `petire-${word}-${digits}`;
}

export async function inviteManager(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sessão sem loja." };

  const parsed = teamInviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const supabase = await createClient();

  const [{ count }, { data: limit }] = await Promise.all([
    supabase
      .from("managers")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId),
    supabase.rpc("store_manager_limit", { target: session.storeId }),
  ]);

  const allowed = limit ?? 1;
  if ((count ?? 0) >= allowed) {
    return {
      error:
        allowed === 1
          ? "Seu plano tem um login só. Fale com o Petire para abrir mais."
          : `Seu plano permite ${allowed} logins, e todos já estão em uso.`,
      values: formValues(formData),
    };
  }

  // service_role só para criar o usuário de auth: não existe outro caminho.
  // Quem pode fazer isso já foi conferido acima, com o cliente autenticado.
  const admin = createAdminClient();
  const password = initialPassword();

  const { data: created, error: userError } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true,
    });

  if (userError || !created.user) {
    return {
      error: userError?.message.includes("already")
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar o acesso.",
      values: formValues(formData),
    };
  }

  const { error } = await admin.from("managers").insert({
    id: created.user.id,
    store_id: session.storeId,
    role: "manager",
    email: parsed.data.email,
  });

  if (error) {
    // Sem a linha em managers o usuário entra e não é dono de nada — e ainda
    // ocuparia o e-mail para sempre.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Não foi possível vincular o acesso à loja." };
  }

  revalidatePath("/gerente/equipe");

  // A senha aparece uma vez só: ela não fica gravada em lugar nenhum legível.
  return {
    error: null,
    savedAt: Date.now(),
    created: { email: parsed.data.email, password },
  };
}

/**
 * Tira um acesso da loja.
 *
 * Apaga o usuário de auth junto: deixar a conta viva sem vínculo faria o
 * ex-funcionário conseguir entrar e cair numa tela de "sem acesso" — e o
 * e-mail dele ficaria ocupado para sempre.
 *
 * Ninguém remove a si mesmo. Não é sobre hierarquia: é que o único gerente
 * removendo a própria conta deixaria a loja sem nenhum login, e a saída seria
 * ligar para o Petire.
 */
export async function removeManager(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManager();
  if (!session.storeId) return { error: "Sessão sem loja." };

  const managerId = String(formData.get("managerId") ?? "");
  if (!managerId) return { error: "Acesso inválido." };

  if (managerId === session.userId) {
    return { error: "Você não pode remover o próprio acesso." };
  }

  const supabase = await createClient();

  // O RLS de managers já limita à própria loja, mas a conferência aqui é o que
  // impede a exclusão do usuário de auth logo abaixo, que roda com
  // service_role e não passa por RLS nenhum.
  const { data: target } = await supabase
    .from("managers")
    .select("id, store_id, role")
    .eq("id", managerId)
    .maybeSingle();

  if (!target || target.store_id !== session.storeId || target.role !== "manager") {
    return { error: "Esse acesso não é desta loja." };
  }

  const admin = createAdminClient();
  await admin.from("managers").delete().eq("id", managerId);
  await admin.auth.admin.deleteUser(managerId);

  revalidatePath("/gerente/equipe");
  return { error: null, savedAt: Date.now() };
}
