"use server";

import { headers } from "next/headers";

import { excedeuLimite, ipDosCabecalhos } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicationSchema,
  formValues,
  toFormState,
  type FormState,
} from "@/lib/validation";

/**
 * A candidatura de uma loja.
 *
 * Escreve com service_role, como as outras escritas públicas: a tabela não
 * aceita insert do browser, e aqui isso importa mais do que nas outras — a fila
 * carrega e-mail e telefone de quem se candidatou.
 *
 * O que **não** acontece aqui: criar a loja e criar o login. Formulário aberto
 * criando usuário de auth é convite a robô, e a senha inicial precisa chegar a
 * uma pessoa. As duas coisas ficam do outro lado da aprovação.
 */
export async function applyForStore(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  /*
    O formulário é aberto e escreve com service_role, então ele é a porta mais
    barata do site para encher uma tabela — e a tabela é a fila que uma pessoa
    lê à mão toda manhã. Cinco por minuto por IP não é defesa contra alguém
    determinado (o limitador vive na memória de cada processo, e IP se troca),
    mas para o robô comum é o suficiente.

    O erro é o mesmo texto de falha do resto: quem esbarrar no limite sem ser
    robô tenta de novo daqui a pouco, e não ganha um mapa do que existe aqui.
  */
  const ip = ipDosCabecalhos(await headers());
  if (excedeuLimite(`cadastro:${ip}`, Date.now(), 5)) {
    return {
      error: "Muitos envios seguidos. Tente de novo em um minuto.",
      values: formValues(formData),
    };
  }

  const parsed = applicationSchema.safeParse({
    storeName: formData.get("storeName"),
    managerEmail: formData.get("managerEmail"),
    whatsapp: formData.get("whatsapp") ?? "",
    cep: formData.get("cep") ?? "",
    stateUf: formData.get("stateUf") ?? "",
    ibgeCode: formData.get("ibgeCode") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    kind: formData.get("kind"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) return toFormState(parsed.error, formValues(formData));

  const data = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.from("store_applications").insert({
    store_name: data.storeName,
    manager_email: data.managerEmail,
    whatsapp_e164: data.whatsapp,
    cep: data.cep,
    address: data.address,
    city: data.city,
    neighborhood: data.neighborhood,
    state_uf: data.stateUf,
    ibge_code: data.ibgeCode,
    kind: data.kind,
    note: data.note,
  });

  if (error) {
    // Índice único parcial: já existe um pedido pendente com este e-mail.
    // Mandar duas vezes é o comportamento normal de quem não teve resposta em
    // um dia, então isto não é erro dele.
    if (error.code === "23505") {
      return {
        error: null,
        savedAt: Date.now(),
      };
    }

    return {
      error: "Não consegui enviar seu cadastro. Tente de novo?",
      values: formValues(formData),
    };
  }

  return { error: null, savedAt: Date.now() };
}
