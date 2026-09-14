import { expect, test, type Page } from "@playwright/test";

/**
 * O painel do lojista, pelo caminho que ele percorre.
 *
 * Entrou por um defeito relatado: organizando o cardápio, em certo momento o
 * item parava de se mover, e recarregar não resolvia. A causa era a
 * reordenação acontecer em duas etapas — ler a lista, depois escrever item por
 * item —, com N+1 idas ao servidor por clique. Quem não vê resposta clica de
 * novo, e o segundo clique lia a ordem antes de o primeiro terminar.
 *
 * A decisão desceu para uma função no banco, e `scripts/check-rls.mjs` prova
 * que ela ordena certo e que um lojista não reordena a loja do vizinho. O que
 * falta provar é a ligação: que o botão da tela chega até lá e que a página
 * volta com a ordem nova. É o que este arquivo faz.
 *
 * Login do seed: gerente@petire.local / petire123.
 */

async function entrar(page: Page) {
  await page.goto("/entrar");
  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill("gerente@petire.local");
  await page.getByLabel("Senha").fill("petire123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/gerente/);
}

/** A seção "Lanches" do cardápio do seed. */
function secaoLanches(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Lanches" }) });
}

/**
 * As setas dos **itens** da seção.
 *
 * Dentro do `li`, e não em qualquer lugar da seção: a própria categoria também
 * tem setas, com o mesmo formato de rótulo ("Mover Lanches para cima"), e sem
 * este recorte ela entrava na conta como se fosse o primeiro item da lista.
 */
function setasDosItens(page: Page, direcao: "cima" | "baixo") {
  const rotulo =
    direcao === "cima" ? /^Mover .+ para cima$/ : /^Mover .+ para baixo$/;
  return secaoLanches(page).locator("li").getByRole("button", { name: rotulo });
}

/**
 * Os nomes dos itens, na ordem da tela.
 *
 * Lidos do rótulo das próprias setas, e não do texto da linha: a linha ainda
 * traz o botão de foto e o de disponibilidade, e uma mudança de layout viraria
 * falha de teste sem nada ter quebrado.
 */
async function nomesNaOrdem(page: Page): Promise<string[]> {
  // `evaluateAll` não espera nada: devolve o que existir no instante da
  // chamada, e numa página recém-navegada isso pode ser lista vazia.
  await setasDosItens(page, "baixo").first().waitFor();

  const rotulos = await setasDosItens(page, "cima").evaluateAll((botoes) =>
    botoes.map((b) => b.getAttribute("aria-label") ?? ""),
  );

  return rotulos.map((r) =>
    r.replace(/^Mover /, "").replace(/ para cima$/, ""),
  );
}

test("a seta reordena o item, e a ordem volta na página", async ({ page }) => {
  await entrar(page);
  await page.goto("/gerente/cardapio");

  const antes = await nomesNaOrdem(page);
  expect(antes.length).toBeGreaterThan(1);

  await secaoLanches(page)
    .locator("li")
    .getByRole("button", { name: `Mover ${antes[1]} para cima` })
    .click();

  /*
    A página volta com a ordem nova — é o revalidatePath da ação fazendo
    efeito. Sem ele o clique gravaria no banco e a tela continuaria igual.

    A espera **recarrega** a cada tentativa. Sem isso ela relê o mesmo DOM: se
    uma revalidação disparada por outro teste chegar logo depois do clique, a
    tela pode ficar com um desenho anterior à troca, e insistir na mesma página
    nunca a corrigiria. Foi essa a instabilidade que apareceu uma vez em cinco
    rodadas da bateria inteira, e nunca quando este arquivo rodava sozinho.
  */
  await expect
    .poll(
      async () => {
        await page.reload();
        return nomesNaOrdem(page);
      },
      { timeout: 15_000, intervals: [300, 700, 1500] },
    )
    .toEqual([antes[1], antes[0], ...antes.slice(2)]);
});

test("o primeiro item não tem para onde subir", async ({ page }) => {
  await entrar(page);
  await page.goto("/gerente/cardapio");

  const nomes = await nomesNaOrdem(page);

  await expect(
    secaoLanches(page)
      .locator("li")
      .getByRole("button", { name: `Mover ${nomes[0]} para cima` }),
  ).toBeDisabled();
});
