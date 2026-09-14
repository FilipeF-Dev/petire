import { expect, type Page } from "@playwright/test";

/**
 * O que as duas jornadas precisam do painel.
 *
 * Não é um arquivo de teste — mora aqui porque a jornada do cliente também
 * encena o lojista: a rede de segurança mais importante do carrinho só pode
 * ser provada com os dois lados agindo ao mesmo tempo.
 *
 * Login do seed: gerente@petire.local / petire123.
 */

export async function entrarComoLojista(page: Page) {
  await page.goto("/entrar");
  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill("gerente@petire.local");
  await page.getByLabel("Senha").fill("petire123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/[/]gerente/);
}

/**
 * Nome único por execução.
 *
 * Cada teste trabalha com item próprio, e não com um do seed. Dois testes
 * marcando "esgotado" no mesmo item disputam o resultado um do outro, e uma
 * execução que morra no meio deixa o item esgotado para a próxima — teste que
 * falha por causa da bagunça do anterior não avisa nada sobre o sistema.
 */
export function nomeUnico(prefixo: string): string {
  return `${prefixo} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Cadastra um item e volta para a lista do cardápio.
 *
 * O `goto` no fim não é enfeite: criar um item leva o lojista para a **página
 * do item**, e não de volta para a lista — é lá que ele põe a foto e os grupos
 * de opção. Quem escrever um teste assumindo o contrário fica esperando por
 * uma lista que não está na tela.
 */
export async function criarItem(page: Page, nome: string, preco: string) {
  await page.goto("/gerente/cardapio/produto/novo");
  await page.getByRole("textbox", { name: "Nome" }).fill(nome);
  await page.getByRole("textbox", { name: "Preço" }).fill(preco);
  await page.getByRole("button", { name: "Criar item" }).click();
  await page.waitForURL(/[/]gerente[/]cardapio[/]produto[/][0-9a-f-]{36}/);
  await page.goto("/gerente/cardapio");
}

/** A linha daquele item na lista do cardápio. */
export function linhaDo(page: Page, nome: string) {
  return page.locator("li").filter({ hasText: nome });
}

/**
 * Marca o item como esgotado e espera o **servidor** confirmar.
 *
 * A espera é pela resposta da Server Action, e não pelo rótulo do botão. O
 * rótulo troca no toque, por otimismo, antes de qualquer coisa ter sido
 * gravada — quem começa a contar por ele começa cedo demais, e foi isso que
 * deixou dois testes instáveis: eles conferiam o outro lado enquanto a
 * gravação ainda estava no ar.
 *
 * Vale registrar o que essa distinção diz do produto: o lojista também vê
 * "Esgotado" antes da confirmação. Se a gravação falhar, ele fica com um
 * painel dizendo uma coisa e um cardápio dizendo outra.
 */
export async function marcarEsgotado(page: Page, nome: string) {
  const linha = linhaDo(page, nome);

  await Promise.all([
    page.waitForResponse(
      (resposta) =>
        resposta.request().method() === "POST" &&
        resposta.request().headers()["next-action"] !== undefined,
    ),
    linha.getByRole("button", { name: "Disponível" }).click(),
  ]);

  await expect(linha.getByRole("button", { name: "Esgotado" })).toBeVisible();
}

/**
 * Espera o item aparecer na página pública da loja.
 *
 * A vitrine é estática: `revalidatePath` marca a página como velha e o Next
 * serve a versão antiga enquanto gera a nova. Medido aqui, o item novo demora
 * uma ou duas visitas para aparecer. Cravar "aparece na primeira" seria
 * escrever no teste uma garantia que a arquitetura não dá.
 */
export async function esperarNaLoja(page: Page, slug: string, nome: string) {
  await expect
    .poll(
      async () => {
        await page.goto(`/loja/${slug}`);
        return page.getByRole("button", { name: new RegExp(nome) }).count();
      },
      { timeout: 20_000, intervals: [400, 600, 1000, 2000] },
    )
    .toBeGreaterThan(0);
}
