import { expect, test, type Page } from "@playwright/test";

import {
  criarItem,
  entrarComoLojista,
  esperarNaLoja,
  marcarEsgotado,
  nomeUnico,
} from "./lojista";

/**
 * O cliente montando o pedido, pelos caminhos que ele realmente faz.
 *
 * `pedido.spec.ts` cobre o percurso feliz — um item, uma loja, uma mensagem.
 * Aqui estão os caminhos tortos, que é onde um erro custa caro sem ninguém
 * perceber: dois carrinhos ao mesmo tempo, um item que acaba enquanto o
 * cliente decide, um pedido que não alcança o mínimo.
 *
 * A regra é a mesma da jornada do lojista: afirmar a consequência visível, e
 * nunca só que a tela não quebrou.
 */

const ZE = "lanchonete-do-ze";
const PIZZARIA = "pizzaria-da-esquina";

/** Põe um item no carrinho, resolvendo o que ele obrigar a escolher. */
async function adicionar(page: Page, loja: string, item: string) {
  await page.goto(`/loja/${loja}`);
  await page.getByRole("button", { name: item }).click();

  // Grupo obrigatório marca a primeira opção; item sem grupo nem tem rádio.
  const obrigatorio = page.getByRole("radio").first();
  if (await obrigatorio.isVisible().catch(() => false)) {
    await obrigatorio.check();
  }

  await page.getByRole("button", { name: /^Adicionar · / }).click();
}

test("o carrinho separa as lojas, e cada pedido vai para o número certo", async ({
  page,
}) => {
  /*
    Pedir de duas lojas é comum: o lanche numa, a bebida na outra. O carrinho
    tem de manter as duas contas separadas e mandar cada mensagem para o dono
    dela — misturar aqui é o cliente pedindo pizza para a lanchonete.
  */
  const mensagens: string[] = [];
  await page.route("https://wa.me/**", (route) => {
    mensagens.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "WhatsApp" });
  });

  await adicionar(page, ZE, "X-Salada");
  await adicionar(page, PIZZARIA, "Margherita");

  await page.goto("/carrinho");
  await expect(page.getByText(/itens de 2 lojas/)).toBeVisible();

  // Cada loja tem o próprio botão de enviar, com o nome dela escrito.
  await page
    .getByRole("button", { name: /Pizzaria da Esquina|Enviar mesmo assim/ })
    .first()
    .click();
  await page.getByRole("textbox", { name: /Quem vai/ }).fill("Filipe");
  const numero = page.getByRole("textbox", { name: "Número" });
  if (await numero.isVisible().catch(() => false)) await numero.fill("120");
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();

  await page.waitForURL(/wa\.me/);
  const destino = new URL(page.url());
  const texto = decodeURIComponent(destino.searchParams.get("text") ?? "");

  // Do seed: 5511998887777 é a Pizzaria. O X-Salada não pode estar aqui.
  expect(destino.pathname).toBe("/5511998887777");
  expect(texto).toContain("Margherita");
  expect(texto).not.toContain("X-Salada");
});

test("o item que acaba enquanto o cliente decide sai do carrinho", async ({
  page,
  browser,
}) => {
  /*
    A rede de segurança que torna aceitável a vitrine ser estática.

    O lojista marca "esgotado" e a página da loja leva uma ou duas visitas para
    refletir isso — é o preço de a página ser gerada uma vez e servida a todos.
    O que não pode acontecer é o pedido **sair** com o que acabou: quem paga
    essa conta é o cliente na porta e o lojista no telefone.

    Por isso o carrinho relê o cardápio antes de montar a mensagem, em vez de
    confiar no que guardou. Aqui os dois lados agem ao mesmo tempo, em dois
    navegadores: o cliente com o item no carrinho e o lojista no painel.

    O item é criado para este teste, e não tirado do seed. Dois testes marcando
    esgotado no mesmo item disputam o resultado um do outro, e uma execução que
    morra no meio deixa o item esgotado para a próxima.
  */
  const painel = await browser.newContext();
  const lojista = await painel.newPage();
  const nome = nomeUnico("Some do carrinho");

  await entrarComoLojista(lojista);
  await criarItem(lojista, nome, "15,00");

  // O cliente só consegue pedir o que já apareceu na vitrine.
  await esperarNaLoja(page, ZE, nome);
  await adicionar(page, ZE, nome);
  await page.goto("/carrinho");
  await expect(page.getByText(nome)).toBeVisible();

  await marcarEsgotado(lojista, nome);

  /*
    O cliente volta ao carrinho. O item some, e ele fica sabendo por quê.

    Uma recarga só, e não uma espera que recarrega: o aviso existe para a
    visita em que a remoção acontece, e recarregar de novo o apagaria — na
    segunda vez a linha já não está no aparelho, nada é removido, e não há o
    que avisar. Uma espera que insiste destruiria justamente o que procura.

    Funciona porque `marcarEsgotado` só volta depois de o servidor responder.
  */
  await page.reload();

  await expect(
    page.getByText("Um item saiu do cardápio e foi removido do carrinho."),
  ).toBeVisible();
  await expect(page.getByText(nome)).toBeHidden();

  await painel.close();
});

test("abaixo do pedido mínimo, o botão diz quanto falta", async ({ page }) => {
  /*
    A Distribuidora atende a partir de R$ 15,00 e o Gelo custa R$ 12,00. Um
    botão apagado sem explicação faria o cliente achar que o site quebrou;
    dizendo o que falta, ele vira uma sugestão de compra.
  */
  await adicionar(page, "distribuidora-do-bairro", "Gelo 5kg");
  await page.goto("/carrinho");

  await expect(
    page.getByRole("button", { name: /Faltam R\$ 3,00 para o pedido mínimo/ }),
  ).toBeDisabled();
});

test("dois toques rápidos em + contam os dois", async ({ page }) => {
  /*
    A forma do bug da reordenação, do lado do cliente. Lá, dois cliques
    viravam um porque o segundo lia o estado antes de o primeiro gravar. Aqui
    a quantidade vive no aparelho, então a pergunta é se o mesmo tipo de perda
    acontece — e a resposta tem de ser não, inclusive depois de recarregar.
  */
  await adicionar(page, ZE, "Coca-Cola lata 350ml");
  await page.goto("/carrinho");

  const mais = page.getByRole("button", { name: /^Aumentar Coca-Cola/ });
  await mais.click();
  await mais.click();

  await page.reload();
  // R$ 7,00 cada, três unidades.
  await expect(page.getByText("R$ 21,00").first()).toBeVisible();
});

test("busca sem resultado no cardápio diz isso, e não uma tela vazia", async ({
  page,
}) => {
  await page.goto(`/loja/${ZE}`);
  await page
    .getByRole("searchbox", { name: "Buscar no cardápio" })
    .fill("jabuticaba");

  await expect(page.getByText("Nenhum item com esse nome.")).toBeVisible();
});
