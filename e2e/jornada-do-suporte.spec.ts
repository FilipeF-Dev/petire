import { expect, test, type Page } from "@playwright/test";

import { entrarComoLojista, linhaDo } from "./lojista";

/**
 * O suporte do Petire cadastrando o cardápio de uma loja.
 *
 * É a jornada do primeiro dia de uma loja nova: alguém do Petire tem a foto do
 * cardápio, pede a uma IA para transcrever no formato, cola o resultado e a
 * loja fica pronta — com os grupos de opção, que é onde o cadastro manual
 * sempre parava pela metade.
 *
 * O que se prova aqui é a ponta a ponta inteira: o JSON entra pela tela do
 * admin, vira produto, grupo, opção e ligação no banco, e sai do outro lado
 * como um item que o cliente consegue pedir — com a escolha obrigatória
 * mudando o preço.
 *
 * Login do seed: admin@petire.local / petire123.
 */

const LOJA = "lanchonete-do-ze";
const ID_DA_LOJA = "11111111-1111-4111-8111-111111111111";

async function entrarComoAdmin(page: Page) {
  await page.goto("/entrar");
  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill("admin@petire.local");
  await page.getByLabel("Senha").fill("petire123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/[/]gerente/);
}

test("o suporte cola um cardápio com grupos e o cliente consegue pedir", async ({
  page,
}) => {
  const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const item = `Refrigerante ${sufixo}`;

  await entrarComoAdmin(page);
  await page.goto(`/admin/loja/${ID_DA_LOJA}`);

  /*
    O caso que motivou o formato: item cujo preço mora na escolha. "preco": 0
    com um grupo obrigatório — é a Fanta que custa pelo sabor, e é o que o
    cadastro manual não conseguia colar.
  */
  await page.getByRole("textbox", { name: "Cardápio", exact: true }).fill(
    JSON.stringify({
      secoes: [
        {
          nome: `Geladeira ${sufixo}`,
          itens: [
            {
              nome: item,
              preco: 0,
              descricao: "Lata gelada.",
              grupos: [
                {
                  nome: "Sabor",
                  min: 1,
                  max: 1,
                  opcoes: [
                    { nome: "Guaraná", mais: 7.5 },
                    { nome: "Laranja", mais: 7.5 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  );

  // A conferência mostra o grupo e o que cada opção soma — é o que torna
  // aceitável colar um cardápio que ninguém digitou.
  await expect(page.getByText("Sabor · obrigatório")).toBeVisible();
  await expect(page.getByText("+R$ 7,50").first()).toBeVisible();

  await page.getByRole("button", { name: /^Importar 1 item$/ }).click();
  await expect(page.getByText("Cardápio importado.")).toBeVisible();

  // Do outro lado: o cliente abre a loja e pede.
  await expect
    .poll(
      async () => {
        await page.goto(`/loja/${LOJA}`);
        return page.getByRole("button", { name: new RegExp(item) }).count();
      },
      { timeout: 20_000, intervals: [400, 600, 1000, 2000] },
    )
    .toBeGreaterThan(0);

  const card = page.getByRole("button", { name: new RegExp(item) });
  // O preço de entrada vem do grupo obrigatório, não do item.
  await expect(card).toContainText("a partir de");
  await expect(card).toContainText("R$ 7,50");

  await card.click();
  await page.getByRole("radio", { name: /Guaraná/ }).check();
  await expect(
    page.getByRole("button", { name: "Adicionar · R$ 7,50" }),
  ).toBeVisible();
});

test("grupo citado por dois itens vira um grupo só, e não dois", async ({
  page,
  browser,
}) => {
  /*
    A regra que o suporte já aplicava na mão e agora está escrita no pedido à
    IA: grupo que se repete é declarado uma vez e citado pelos itens.

    O que se prova aqui é que a economia chega ao banco, e não só ao texto. Se
    cada item ganhasse a própria cópia, o lojista mudaria o preço do bacon num
    lanche e continuaria errado no outro — que é exatamente a dor que fez o
    grupo deixar de pertencer ao produto.
  */
  const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const grupo = `Adicionais ${sufixo}`;
  const primeiro = `Lanche A ${sufixo}`;
  const segundo = `Lanche B ${sufixo}`;

  await entrarComoAdmin(page);
  await page.goto(`/admin/loja/${ID_DA_LOJA}`);

  await page.getByRole("textbox", { name: "Cardápio", exact: true }).fill(
    JSON.stringify({
      grupos: {
        extras: {
          nome: grupo,
          min: 0,
          max: 2,
          opcoes: [{ nome: "Bacon", mais: 5 }],
        },
      },
      secoes: [
        {
          nome: `Lanches ${sufixo}`,
          itens: [
            { nome: primeiro, preco: 20, usa: ["extras"] },
            { nome: segundo, preco: 25, usa: ["extras"] },
          ],
        },
      ],
    }),
  );

  // A conferência mostra o grupo nos dois, porque é o que o cliente vai ver —
  // ela não pode esconder que o item tem adicionais só porque eles foram
  // declarados no topo.
  await expect(page.getByText(`${grupo} · opcional`)).toHaveCount(2);

  await page.getByRole("button", { name: /^Importar 2 itens$/ }).click();
  await expect(page.getByText("Cardápio importado.")).toBeVisible();

  // Os dois lanches oferecem o adicional ao cliente.
  await expect
    .poll(
      async () => {
        await page.goto(`/loja/${LOJA}`);
        return page.getByRole("button", { name: new RegExp(segundo) }).count();
      },
      { timeout: 20_000, intervals: [400, 600, 1000, 2000] },
    )
    .toBeGreaterThan(0);

  for (const lanche of [primeiro, segundo]) {
    await page.goto(`/loja/${LOJA}`);
    await page.getByRole("button", { name: new RegExp(lanche) }).click();
    await expect(
      page.getByRole("checkbox", { name: /Bacon/ }).first(),
    ).toBeVisible();
    await expect(page.getByText(grupo)).toBeVisible();
  }

  /*
    E a prova de que é **um** grupo, e não dois iguais: o painel do lojista
    escreve a diferença no botão. Grupo usado por mais de um item oferece
    "tirar deste item"; grupo de um só oferece "apagar grupo".

    Sem isso o teste passaria com duas cópias — os dois lanches mostrariam o
    adicional do mesmo jeito, e a economia que motivou o formato não estaria
    provada em lugar nenhum.
  */
  const painel = await browser.newContext();
  const lojista = await painel.newPage();

  await entrarComoLojista(lojista);
  await lojista.goto("/gerente/cardapio");
  await linhaDo(lojista, primeiro).getByRole("link").first().click();
  await lojista.waitForURL(/[/]gerente[/]cardapio[/]produto[/][0-9a-f-]{36}/);

  await expect(lojista.getByText(grupo)).toBeVisible();
  await expect(
    lojista.getByRole("button", { name: "tirar deste item" }),
  ).toBeVisible();
  await expect(
    lojista.getByRole("button", { name: "apagar grupo" }),
  ).toHaveCount(0);

  await painel.close();
});
