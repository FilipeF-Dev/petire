import { expect, test } from "@playwright/test";

import {
  criarItem,
  entrarComoLojista,
  esperarNaLoja,
  linhaDo,
  marcarEsgotado,
  nomeUnico,
} from "./lojista";

/**
 * O lojista usando o painel de verdade, do começo ao fim.
 *
 * Estes testes nasceram de um defeito que nenhuma camada anterior pegava: a
 * reordenação do cardápio parava de funcionar, e o teste de lógica pura e o de
 * RLS diziam que estava tudo certo — porque o defeito não estava na regra nem
 * no banco. Estava na ligação: painel → ação → banco → revalidação → página
 * pública.
 *
 * É essa ligação que aqui se percorre. A regra é a mesma em todos: depois de
 * cada ação, afirmar **a consequência visível**, nunca só que a tela não
 * quebrou. Bug silencioso é exatamente o que passa por teste que confere
 * ausência de erro.
 */

const LOJA = "lanchonete-do-ze";

test("cria um item e ele aparece no cardápio público", async ({ page }) => {
  /*
    A jornada que o Petire existe para servir: o lojista cadastra e o cliente
    vê. Ela atravessa tudo — formulário, ação, banco, revalidatePath e a página
    estática da loja. Se o revalidatePath sumir um dia, é aqui que aparece: o
    item existiria no painel e não no cardápio, que é o pior estado possível.
  */
  const nome = nomeUnico("Teste Jornada");

  await entrarComoLojista(page);
  await criarItem(page, nome, "18,50");

  await expect(linhaDo(page, nome)).toBeVisible();

  await page.goto(`/loja/${LOJA}`);
  await expect(
    page.getByRole("button", { name: new RegExp(nome) }),
  ).toBeVisible();
});

test("marcar esgotado chega ao cliente, ainda que não no mesmo instante", async ({
  page,
}) => {
  /*
    O toque que o lojista dá no meio do movimento, com a mão ocupada. Ele tem
    resposta otimista na tela — o rótulo troca na hora —, e otimismo que não é
    confirmado é mentira. Por isso a conferência é na loja, e não no botão.

    E a conferência **espera**, de propósito: medido aqui, a página da loja
    ainda entrega o item disponível na primeira e às vezes na segunda visita
    depois do toque. Não é defeito, é o preço da vitrine ser estática. O que
    não pode é o cliente **pedir** o que acabou, e disso quem cuida é o
    carrinho, que relê o cardápio antes de montar a mensagem — provado na
    jornada do cliente.
  */
  const nome = nomeUnico("Esgotar");

  await entrarComoLojista(page);
  await criarItem(page, nome, "9,90");
  await marcarEsgotado(page, nome);

  /*
    A espera devolve um estado, e não um booleano com um `expect` dentro.

    A primeira versão afirmava `toBeVisible` dentro do próprio `poll`, e isso
    o tornava instável: na visita em que a página ainda vinha velha, o
    `expect` estourava e derrubava a espera inteira em vez de tentar de novo.
    O teste acusava um defeito que não existia.

    Medido num servidor já aquecido: a mudança chega à loja em cerca de um
    segundo, em duas ou três visitas. O teto de trinta segundos existe para o
    servidor **frio** — a primeira regeneração depois de o processo subir é
    bem mais lenta, e foi ela que deixou este teste instável quando o teto era
    de dez. Folga, e não expectativa.

    "sumiu" é um estado de propósito: se o item deixar o cardápio em vez de
    ficar desabilitado, a falha diz isso — o cliente acharia que a loja parou
    de vender aquilo, que é pior do que ver "esgotado".
  */
  await expect
    .poll(
      async () => {
        await page.goto(`/loja/${LOJA}`);
        const item = page.getByRole("button", { name: new RegExp(nome) });
        if ((await item.count()) === 0) return "sumiu do cardápio";
        return (await item.isDisabled()) ? "esgotado" : "ainda disponível";
      },
      { timeout: 30_000, intervals: [400, 600, 1000, 2000] },
    )
    .toBe("esgotado");
});

test("criar categoria e ela vira seção no cardápio", async ({ page }) => {
  const nome = nomeUnico("Categoria");

  await entrarComoLojista(page);
  await page.goto("/gerente/cardapio");
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await page.waitForURL(/categoria[/]nova/);

  await page.getByRole("textbox", { name: "Nome da categoria" }).fill(nome);
  await page.getByRole("button", { name: "Criar categoria" }).click();
  await page.waitForURL(/[/]gerente[/]cardapio$/);

  await expect(
    page.getByRole("heading", { name: nome, exact: true }),
  ).toBeVisible();
});

test("dois toques seguidos em esgotado não se anulam", async ({ page }) => {
  /*
    A forma do bug da reordenação, aplicada a outro controle.

    Lá, dois cliques rápidos viravam um: o segundo lia o estado antes de o
    primeiro terminar de gravar. Aqui o desenho já se protege — o botão fica
    desabilitado enquanto a gravação está no ar, então o segundo toque não tem
    como atropelar o primeiro. Medido fora do teste: oito de oito vezes os dois
    toques se anularam, como deviam.

    O que este teste guarda é essa proteção. Se alguém tirar o `disabled` do
    toggle um dia, os dois toques passam a disputar e o item fica num estado que
    ninguém pediu — e é aqui que isso aparece.

    A conferência é depois de recarregar, e não no rótulo: o botão troca de
    texto na hora, por otimismo, e é justamente o otimismo que pode mentir.
  */
  const nome = nomeUnico("Dois toques");

  await entrarComoLojista(page);
  await criarItem(page, nome, "7,00");

  const botao = linhaDo(page, nome).getByRole("button", {
    name: /Disponível|Esgotado/,
  });

  await botao.click();
  await botao.click();

  /*
    A espera recarrega a cada tentativa. A anterior recarregava uma vez só e
    podia pegar a página antes de a segunda gravação ter revalidado — falhava
    uma vez a cada tantas rodadas da bateria, sem nada ter quebrado.
  */
  await expect
    .poll(
      async () => {
        await page.reload();
        return linhaDo(page, nome)
          .getByRole("button", { name: /Disponível|Esgotado/ })
          .innerText();
      },
      { timeout: 15_000, intervals: [400, 800, 1500] },
    )
    .toBe("Disponível");
});

test("item sem preço não anuncia R$ 0,00 a ninguém", async ({ page }) => {
  /*
    Do cadastro de uma loja de produção: cinco itens a R$ 0,00, esperando a
    regra de "escolha o tamanho" entrar depois. Enquanto ela não entra, a loja
    anunciava comida de graça no cardápio e o Google recebia uma faixa de preço
    começando em R$ 0,00 — que atrai o clique errado e entrega uma decepção.

    Zero aqui quase nunca é "de graça": é cadastro pela metade. O item continua
    no cardápio e continua pedível, porque perder o item seria pior; o que muda
    é o que está escrito no lugar do número.
  */
  const nome = nomeUnico("Sem preco");

  await entrarComoLojista(page);
  await criarItem(page, nome, "0,00");

  // No painel, marcado — para o lojista achar os que ficaram pelo caminho.
  await expect(linhaDo(page, nome).getByText(/Sem preço/)).toBeVisible();

  await esperarNaLoja(page, LOJA, nome);

  // No cardápio, "a combinar" e nenhum R$ 0,00.
  const card = page.getByRole("button", { name: new RegExp(nome) });
  await expect(card).toContainText("Preço a combinar");
  await expect(card).not.toContainText("R$ 0,00");

  // E fora dos dados estruturados: a faixa da loja não pode começar no zero.
  const dados = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(dados.priceRange ?? "").not.toContain("R$ 0,00");
});

test("apagar uma categoria volta para o cardápio, e não para um 404", async ({
  page,
}) => {
  /*
    Relatado por quem estava organizando o cardápio: apagou uma categoria e
    recebeu 404.

    A causa é o formulário de apagar morar na página **da própria categoria**.
    A ação apagava e terminava sem redirecionar; o Next redesenhava a rota onde
    o lojista estava, a página procurava a categoria que acabou de deixar de
    existir, e respondia 404. Ele apagou com sucesso e levou uma tela de erro.

    É o único apagar do painel com esse formato: os outros são disparados de
    uma tela que continua existindo depois.
  */
  const nome = nomeUnico("Para apagar");

  await entrarComoLojista(page);
  await page.goto("/gerente/cardapio/categoria/nova");
  await page.getByRole("textbox", { name: "Nome da categoria" }).fill(nome);
  await page.getByRole("button", { name: "Criar categoria" }).click();
  await page.waitForURL(/[/]gerente[/]cardapio$/);

  /*
    A espera recarrega a cada tentativa. Sem isso ela relê o mesmo desenho: uma
    revalidação de /gerente/cardapio disparada por outro teste pode deixar a
    página sem a categoria recém-criada, e insistir na mesma tela nunca a
    traria de volta. Mesma instabilidade que já apareceu na reordenação.
  */
  const secao = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: nome, exact: true }) });

  await expect
    .poll(
      async () => {
        await page.reload();
        return secao.count();
      },
      { timeout: 15_000, intervals: [300, 700, 1500] },
    )
    .toBeGreaterThan(0);

  // O "editar" da seção — é por ele que se chega à tela de apagar.
  await secao.getByRole("link", { name: "editar" }).click();
  await page.waitForURL(/[/]gerente[/]cardapio[/]categoria[/]/);

  await page.getByRole("button", { name: "Apagar categoria" }).click();

  /*
    Quinze segundos, e não os cinco do padrão: apagar é uma ida ao servidor, e
    com a bateria inteira rodando em paralelo ela passa dos cinco. O que se
    afirma aqui é o **destino**, não a velocidade — e um teto apertado transforma
    servidor ocupado em falha de teste.
  */
  await expect(page).toHaveURL(/[/]gerente[/]cardapio$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: nome, exact: true }),
  ).toHaveCount(0);
});
