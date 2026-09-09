"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

/**
 * `next` vem da query string, então é entrada do usuário. Só aceitamos caminhos
 * internos da área logada — sem isso, `/entrar?next=https://outro.site` viraria
 * um open redirect com a marca do Petire.
 */
function safeNext(value: string | null): string {
  if (!value) return "/gerente";
  if (value.startsWith("/gerente") || value.startsWith("/admin")) return value;
  return "/gerente";
}

/**
 * Limpa o que o navegador guardou das telas logadas.
 *
 * Era `revalidatePath("/", "layout")`, que a documentação do Next descreve
 * como "invalidar **todos** os dados em cache" — o catálogo público inteiro
 * junto. Cada login de lojista mandava a vitrine ser renderizada de novo, e
 * são páginas que revalidam de hora em hora justamente por não mudarem. Com
 * quatro lojas ninguém sente; com mil, cada entrada no painel custa mil
 * renderizações que ninguém pediu.
 *
 * O que realmente precisa sumir é o cache do navegador das telas logadas — do
 * contrário, voltar depois de sair mostraria o painel de quem já saiu. Este
 * caminho estreito continua fazendo isso: hoje, chamado de uma Server
 * Function, qualquer `revalidatePath` limpa o Client Cache inteiro. A própria
 * documentação diz que isso é temporário e um dia passará a valer só para o
 * caminho informado — no dia em que mudar, é aqui que se troca por uma
 * limpeza explícita, e não voltando ao martelo de antes.
 */
function forgetLoggedInScreens(area: "/gerente" | "/admin"): void {
  revalidatePath(area, "layout");
}

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next") as string | null);

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagem genérica de propósito: distinguir "e-mail não existe" de "senha
    // errada" entrega a lista de gerentes cadastrados.
    return { error: "E-mail ou senha incorretos." };
  }

  forgetLoggedInScreens(next.startsWith("/admin") ? "/admin" : "/gerente");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Os dois, porque daqui já não dá para saber quem saiu — e é justamente na
  // saída que uma tela logada esquecida no cache seria o pior erro.
  forgetLoggedInScreens("/gerente");
  forgetLoggedInScreens("/admin");
  redirect("/entrar");
}
