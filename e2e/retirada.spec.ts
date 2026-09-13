import { expect, test } from "@playwright/test";

/**
 * A loja que não entrega.
 *
 * Apareceu no cadastro de uma lanchonete de verdade: ela recebe o pedido pelo
 * WhatsApp e o cliente busca. O site inteiro tratava entrega como fato — toda
 * loja com taxa, todo carrinho somando essa taxa, e o último passo pedindo o
 * endereço de quem recebe.
 *
 * O que este teste guarda não é a tela: é a promessa. Um pedido de retirada
 * não pode sair com linha de entrega, e tem de levar o endereço da loja — é
 * ele que o cliente vai procurar na conversa quando estiver saindo de casa.
 *
 * No seed, a Distribuidora do Bairro é `service_mode = 'pickup'`.
 */

const WHATSAPP_DA_DISTRIBUIDORA = "5511912345678";

test("quem não entrega diz isso antes de o cliente escolher", async ({
  page,
}) => {
  // Na página da loja, e não no carrinho: descobrir no fim que o pedido tem
  // de ser buscado é a surpresa que faz o cliente desistir.
  await page.goto("/loja/distribuidora-do-bairro");

  await expect(
    page.getByText("Retirada no balcão — esta loja não entrega"),
  ).toBeVisible();
});

test("o pedido de retirada sai sem taxa e com o endereço da loja", async ({
  page,
}) => {
  await page.route("https://wa.me/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "WhatsApp" }),
  );

  await page.goto("/loja/distribuidora-do-bairro");

  /*
    Gelo 5kg, R$ 12,00 no seed, e dois deles: a Distribuidora atende a partir
    de R$ 15,00, e um saco sozinho para o carrinho antes do botão de enviar.
    Vale como lembrete de que o pedido mínimo continua valendo na retirada —
    ele é do lojista, e não da entrega.
  */
  await page.getByRole("button", { name: "Gelo 5kg" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await page.getByRole("button", { name: /^Adicionar · / }).click();

  await page.getByRole("link", { name: "Ver carrinho" }).click();

  // Não há o que escolher: a loja só faz uma coisa, e perguntar seria dar ao
  // cliente uma opção que não existe.
  await expect(page.getByRole("button", { name: "Entrega" })).toHaveCount(0);
  await expect(page.getByText("no balcão")).toBeVisible();

  await page
    .getByRole("button", { name: /Fazer pedido|Enviar mesmo assim/ })
    .click();

  // Só o nome. O número e o complemento são do endereço de uma entrega que não
  // vai acontecer.
  await expect(page.getByText("Você busca em")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Número" })).toBeHidden();

  await page.getByRole("textbox", { name: "Quem vai buscar" }).fill("Filipe");
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();

  await page.waitForURL(/wa\.me/);
  const destino = new URL(page.url());
  const mensagem = (destino.searchParams.get("text") ?? "").replaceAll(
    String.fromCharCode(0xa0),
    " ",
  );

  expect(destino.pathname).toBe(`/${WHATSAPP_DA_DISTRIBUIDORA}`);

  expect(mensagem).toContain("Retirada no balcão");
  expect(mensagem).toContain("Endereço da loja: Rua Harmonia, 77");
  expect(mensagem).toContain("Filipe");
  expect(mensagem).toContain("*Total: R$ 24,00*");

  // A linha que não pode existir.
  expect(mensagem).not.toContain("Entrega:");
});

/**
 * A loja que faz as duas coisas — o caso da maioria das lanchonetes de rua, e o
 * único em que o carrinho tem o que perguntar.
 *
 * No seed, a Pizzaria da Esquina é `service_mode = 'both'`, com taxa de
 * R$ 6,00. Margherita R$ 59,00.
 */
test("na loja que faz os dois, escolher retirada tira a taxa", async ({
  page,
}) => {
  await page.route("https://wa.me/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "WhatsApp" }),
  );

  await page.goto("/loja/pizzaria-da-esquina");
  await page.getByRole("button", { name: "Margherita" }).click();
  await page.getByRole("button", { name: /^Adicionar · / }).click();
  await page.getByRole("link", { name: "Ver carrinho" }).click();

  // Entrega vem marcada, porque é o que a maior parte de quem pede quer.
  const entrega = page.getByRole("button", { name: /^Entrega/ });
  const retirar = page.getByRole("button", { name: /^Retirar no balcão/ });
  await expect(entrega).toHaveAttribute("aria-pressed", "true");

  /*
    R$ 65,00 é a pizza mais a taxa, e é o único valor da tela que só aparece no
    total — R$ 59,00 aparece três vezes (linha, subtotal e total), e procurar
    por ele não distinguiria nada. Então o que se afirma é o que de fato muda:
    o total com taxa existe antes e deixa de existir depois.
  */
  await expect(page.getByText("R$ 65,00")).toBeVisible();

  await retirar.click();
  await expect(retirar).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("R$ 65,00")).toHaveCount(0);
  // Exato porque "Retirar no balcão", do próprio botão, também contém isto.
  await expect(page.getByText("no balcão", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: /Fazer pedido|Enviar mesmo assim/ })
    .click();
  await page.getByRole("textbox", { name: "Quem vai buscar" }).fill("Filipe");
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();

  await page.waitForURL(/wa\.me/);
  const mensagem = (
    new URL(page.url()).searchParams.get("text") ?? ""
  ).replaceAll(String.fromCharCode(0xa0), " ");

  // A escolha do cliente é o que chega à loja: sem linha de entrega, e com o
  // total sem a taxa.
  expect(mensagem).toContain("Retirada no balcão");
  expect(mensagem).not.toContain("Entrega:");
  expect(mensagem).toContain("*Total: R$ 59,00*");
});
