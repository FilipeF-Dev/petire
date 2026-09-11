import { defineConfig, devices } from "@playwright/test";

/**
 * O teste de ponta a ponta.
 *
 * O resto da bateria testa pedaços: a lógica pura no vitest, as políticas de
 * acesso no check:rls, o schema no build. Nenhum deles percorre o caminho que
 * paga a conta — cardápio, carrinho, WhatsApp da loja — e é justamente esse
 * caminho que atravessa tudo ao mesmo tempo: banco, render estático, estado no
 * navegador e a montagem da mensagem.
 *
 * Roda contra o site **construído**, e não contra o `next dev`: a vitrine é
 * estática em produção, e é o comportamento de produção que precisa ser
 * provado. Na máquina de quem desenvolve, `reuseExistingServer` aproveita o
 * servidor que já estiver de pé na 3000.
 *
 * Só Chromium. Um navegador que percorre o caminho inteiro encontra quase tudo
 * que três encontrariam, e a bateria precisa continuar rápida o bastante para
 * ser rodada a cada mudança.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    // Rastro só do que falhou: é o que transforma "quebrou no CI" em uma
    // gravação que dá para abrir e ver.
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
