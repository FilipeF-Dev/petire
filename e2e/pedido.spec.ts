import { expect, test } from "@playwright/test";

/**
 * O caminho que paga a conta: cardápio → carrinho → WhatsApp da loja.
 *
 * É o único percurso do site em que um erro custa dinheiro de verdade a
 * alguém. E é o que atravessa todas as camadas de uma vez — a página estática
 * gerada do banco, o estado que vive no navegador, as opções que mudam o
 * preço, a taxa de entrega e a montagem da mensagem.
 *
 * O que ele afirma no fim não é "a tela abriu": é que a conta fechou e que a
 * mensagem foi para **o número da loja certa**. Esses dois são o produto.
 *
 * Os dados vêm do seed (`supabase/seed.sql`), então os valores estão escritos
 * aqui de propósito, e não lidos da tela: um teste que calcula o total do
 * mesmo jeito que o site calcula concorda com qualquer erro.
 */

// Do seed: X-Salada R$ 24,90 · Bacon +R$ 5,00 · entrega R$ 7,00.
const X_SALADA_CENTS = 2490;
const BACON_CENTS = 500;
const ENTREGA_CENTS = 700;
const WHATSAPP_DO_ZE = "5511987654321";

test("do cardápio ao WhatsApp, com a conta fechando", async ({ page }) => {
  /*
    wa.me é interceptado porque o último passo do site é sair dele:
    `window.location.href = whatsappUrl(...)`. Sem isto o teste tentaria abrir
    o WhatsApp de verdade — que no CI não existe, e na máquina de quem
    desenvolve seria pior: abriria.
  */
  await page.route("https://wa.me/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "WhatsApp" }),
  );

  await page.goto("/loja/lanchonete-do-ze");

  // Abre o item e escolhe o que ele obriga a escolher.
  await page.getByRole("button", { name: "X-Salada" }).click();
  await page.getByRole("radio", { name: /Ao ponto/ }).check();
  await page.getByRole("checkbox", { name: /Bacon/ }).first().check();

  // Dois, para o teste não passar por acaso com a quantidade 1.
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();

  const unidade = X_SALADA_CENTS + BACON_CENTS;
  const itens = unidade * 2;

  // O botão mostra o preço antes de adicionar: é a primeira conferência, e a
  // que o cliente realmente lê antes de decidir.
  const adicionar = page.getByRole("button", { name: /^Adicionar · / });
  await expect(adicionar).toHaveText(`Adicionar · ${reais(itens)}`);
  await adicionar.click();

  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);

  // A loja fechada troca o texto do botão, e a hora de rodar o teste não pode
  // decidir se ele passa.
  await page
    .getByRole("button", { name: /Fazer pedido|Enviar mesmo assim/ })
    .click();

  await page.getByRole("textbox", { name: "Quem vai receber" }).fill("Filipe");
  await page.getByRole("textbox", { name: "Número" }).fill("120");
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();

  await page.waitForURL(/wa\.me/);
  const destino = new URL(page.url());
  /*
    O espaço depois de "R$" é um espaço **inquebrável** — é o que o
    `Intl.NumberFormat` do pt-BR usa, para o valor nunca quebrar linha entre o
    símbolo e o número. Comparar com o espaço comum falha aqui e passa em
    qualquer asserção que normalize espaço, o que dá um teste que só quebra
    para quem está com pressa. Normalizar uma vez, no lugar certo, resolve.
  */
  const mensagem = (destino.searchParams.get("text") ?? "").replaceAll(
    String.fromCharCode(0xa0),
    " ",
  );

  // O número. Se um dia isto falhar, o pedido de alguém foi para outra pessoa.
  expect(destino.pathname).toBe(`/${WHATSAPP_DO_ZE}`);

  expect(mensagem).toContain("2x X-Salada");
  expect(mensagem).toContain("Bacon");
  expect(mensagem).toContain("Filipe");
  expect(mensagem).toContain("120");
  expect(mensagem).toContain(reais(ENTREGA_CENTS));
  expect(mensagem).toContain(reais(itens + ENTREGA_CENTS));
});

test("o carrinho sobrevive a recarregar a página", async ({ page }) => {
  /*
    Não é detalhe de implementação: sem cadastro, o carrinho só existe no
    aparelho do cliente. Ele monta o pedido, sai para conferir o endereço, e
    volta. Se o carrinho não voltar com ele, o pedido não acontece.
  */
  await page.goto("/loja/lanchonete-do-ze");
  await page.getByRole("button", { name: "X-Salada" }).click();
  await page.getByRole("radio", { name: /Ao ponto/ }).check();
  await page.getByRole("button", { name: /^Adicionar · / }).click();

  await page.reload();

  await expect(page.getByRole("link", { name: "Ver carrinho" })).toBeVisible();
});

function reais(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
