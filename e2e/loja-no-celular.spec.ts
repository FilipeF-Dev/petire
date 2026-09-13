import { expect, test } from "@playwright/test";

/**
 * Dois gestos de celular que a loja tratava errado.
 *
 * Ambos relatados de um aparelho de verdade, e ambos do mesmo tipo: a página
 * respondia de um jeito que contraria o que o gesto significa para quem o faz.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("o gesto de voltar fecha o pop-up, e não a página", async ({ page }) => {
  /*
    Arrastar da borda para o centro é o "cancelar" do celular, e com o item
    aberto ele significa "desisti deste". O que acontecia era o contrário: o
    pop-up ficava e a página atrás dele voltava — a pessoa perdia o cardápio
    inteiro para fechar uma caixa.

    `goBack` é o mesmo evento que o gesto dispara. Testar o arrasto em si seria
    testar o navegador; o que é nosso é a reação a ele.
  */
  await page.goto("/loja/lanchonete-do-ze");
  await page.getByRole("button", { name: "X-Salada" }).click();

  const dialogo = page.getByRole("dialog", { name: "X-Salada" });
  await expect(dialogo).toBeVisible();

  await page.goBack();

  await expect(dialogo).toBeHidden();
  // E o cardápio continua onde estava: o gesto fechou a caixa, não a loja.
  await expect(page).toHaveURL(/\/loja\/lanchonete-do-ze/);
  await expect(page.getByRole("button", { name: "X-Salada" })).toBeVisible();
});

test("fechar pelo X não deixa uma volta sobrando no histórico", async ({
  page,
}) => {
  /*
    O outro lado da mesma moeda. O pop-up marca uma parada no histórico ao
    abrir; se ele fecha por outro caminho, essa parada precisa sair junto —
    senão o próximo "voltar" da pessoa desfaria um diálogo que já não existe, e
    ela apertaria duas vezes para sair da loja.
  */
  await page.goto("/lojas");
  await page
    .getByRole("link", { name: /Lanchonete do Zé/ })
    .first()
    .click();
  await page.waitForURL(/\/loja\/lanchonete-do-ze/);

  await page.getByRole("button", { name: "X-Salada" }).click();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goBack();

  await expect(page).toHaveURL(/\/lojas/);
});

test("clicar na categoria rola até ela em vez de saltar", async ({ page }) => {
  await page.goto("/loja/lanchonete-do-ze");

  const bebidas = page.getByRole("link", { name: "Bebidas", exact: true });
  await expect(bebidas).toBeVisible();

  const antes = await page.evaluate(() => window.scrollY);
  await bebidas.click();

  /*
    O que se afirma é onde a rolagem **parou**, e não quantos quadros ela levou:
    cronometrar animação em teste dá falha intermitente sem nada ter quebrado.

    O título da seção tem de terminar logo abaixo da barra fixa — perto de 64px
    do topo, com folga para o arredondamento do último quadro. Se a conta da
    folga se perder, ele some por baixo da barra e o teste diz isso.
  */
  await expect
    .poll(
      () =>
        page
          .getByRole("heading", { name: "Bebidas" })
          .evaluate((h) => Math.round(h.getBoundingClientRect().top)),
      { timeout: 5000 },
    )
    .toBeLessThan(80);

  const depois = await page.evaluate(() => window.scrollY);
  expect(depois).toBeGreaterThan(antes);

  // A prova de que foi rolagem e não o salto do âncora: o salto escreve o
  // fragmento no endereço, a rolagem animada não toca nele.
  expect(new URL(page.url()).hash).toBe("");
});
