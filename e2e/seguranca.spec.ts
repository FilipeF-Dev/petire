import { expect, test } from "@playwright/test";

/**
 * O que protege quem abre o site.
 *
 * Os dois casos daqui não nasceram de checklist: nasceram de um bug real. O
 * nome e a descrição da loja são digitados no painel e caíam crus dentro de
 * uma tag `<script>` na página pública. Uma loja com `</script>` na descrição
 * executava código na origem do Petire, para todo cliente que a abrisse — com
 * acesso ao endereço e ao carrinho guardados no aparelho e, pior, com poder de
 * reescrever o link do WhatsApp e desviar o pedido.
 *
 * `src/lib/json-ld.test.ts` cobre o escape. Aqui se cobre a página inteira,
 * porque o escape só serve se estiver no caminho de verdade.
 */

test("a página da loja não deixa texto da loja virar script", async ({
  page,
}) => {
  await page.goto("/loja/lanchonete-do-ze");

  const dados = await page
    .locator('script[type="application/ld+json"]')
    .innerText();

  // O analisador de HTML fecha a tag em qualquer `</script` que apareça. Se
  // um dia houver um aqui, o bloco terminou antes da hora e o que veio depois
  // virou script executável.
  expect(dados).not.toContain("</script");

  const json = JSON.parse(dados);
  expect(json["@type"]).toBe("Restaurant");
  expect(json.name).toBe("Lanchonete do Zé");
});

test("os cabeçalhos de segurança chegam ao navegador", async ({ page }) => {
  const resposta = await page.goto("/loja/lanchonete-do-ze");
  const cabecalhos = resposta!.headers();

  expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
  expect(cabecalhos["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  /*
    Do CSP, só o que ele de fato entrega. O Next injeta script em linha em toda
    página, então `'unsafe-inline'` fica e o CSP **não** impede XSS em linha —
    prometer isso aqui seria mentir para quem ler o teste depois. O que ele
    impede é o estrago: buscar a carga de fora, mandar o carrinho e o endereço
    do cliente para outro servidor, e emoldurar o site num iframe.
  */
  const csp = cabecalhos["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("base-uri 'self'");
});

test("o painel não abre sem login", async ({ page }) => {
  await page.goto("/gerente");
  await expect(page).toHaveURL(/\/entrar/);
});
