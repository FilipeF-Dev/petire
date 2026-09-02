import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Cobre só a lógica pura — dinheiro, promoções e a mensagem do pedido. O que
 * depende do banco é verificado por `npm run check:rls`, contra o Postgres de
 * verdade, porque é lá que as regras moram.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
