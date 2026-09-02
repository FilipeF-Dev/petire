/**
 * Verificação das políticas de RLS contra o banco local.
 *
 * Bug de RLS é silencioso: nada quebra, uma loja simplesmente enxerga ou edita
 * o cardápio da outra. Este script exercita os caminhos que precisam falhar.
 *
 *   npm run db:reset && npm run check:rls
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- env ---------------------------------------------------------------------

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const STORE_ZE = "11111111-1111-4111-8111-111111111111";
const STORE_DIST = "22222222-2222-4222-8222-222222222222";
const CAT_LANCHES = "c1111111-1111-4111-8111-111111111111";

// --- runner ------------------------------------------------------------------

let failures = 0;

async function check(name, fn) {
  try {
    const message = await fn();
    console.log(`  ok    ${name}${message ? ` — ${message}` : ""}`);
  } catch (error) {
    failures += 1;
    console.log(`  FALHA ${name}\n        ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function anonClient() {
  return createClient(URL_, ANON, { auth: { persistSession: false } });
}

async function managerClient(email) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "petire123",
  });
  if (error) throw new Error(`login de ${email} falhou: ${error.message}`);
  return client;
}

// --- checks ------------------------------------------------------------------

console.log("\nVisitante sem login (anon)");

const anon = anonClient();

await check("lê o catálogo de lojas ativas", async () => {
  const { data, error } = await anon.from("stores").select("id, name");
  assert(!error, error?.message ?? "");
  assert(data.length === 2, `esperava 2 lojas, veio ${data.length}`);
  return `${data.length} lojas`;
});

await check("lê produtos do cardápio", async () => {
  const { data, error } = await anon.from("products").select("id");
  assert(!error, error?.message ?? "");
  assert(data.length > 0, "nenhum produto visível");
  return `${data.length} produtos`;
});

await check("NÃO lê a tabela de gerentes", async () => {
  const { error } = await anon.from("managers").select("id");
  assert(error, "anon conseguiu ler managers");
  return error.code;
});

await check("NÃO grava métricas direto no banco", async () => {
  const { error } = await anon
    .from("events")
    .insert({ store_id: STORE_ZE, kind: "whatsapp_click" });
  assert(error, "anon conseguiu inserir em events");
  return error.code;
});

await check("NÃO cria produto", async () => {
  const { error } = await anon
    .from("products")
    .insert({ store_id: STORE_ZE, name: "Invasor", price_cents: 1 });
  assert(error, "anon conseguiu inserir produto");
  return error.code;
});

await check("NÃO lê a situação da assinatura das lojas", async () => {
  const { error } = await anon
    .from("stores")
    .select("subscription_status, subscription_until");
  assert(error, "anon leu dados de assinatura");
  return error.code;
});

await check("lê a vitrine com o status de aberto resolvido", async () => {
  const { data, error } = await anon
    .from("stores_public")
    .select("slug, name, is_open_now");
  assert(!error, error?.message ?? "");
  assert(data.length === 2, `esperava 2 lojas, veio ${data.length}`);
  assert(
    data.every((s) => typeof s.is_open_now === "boolean"),
    "is_open_now não veio como booleano",
  );
});

console.log("\nGerente da Lanchonete do Zé");

const ze = await managerClient("gerente@petire.local");

await check("vê só a própria linha em managers", async () => {
  const { data, error } = await ze.from("managers").select("id, store_id");
  assert(!error, error?.message ?? "");
  assert(data.length === 1, `esperava 1 linha, veio ${data.length}`);
  assert(data[0].store_id === STORE_ZE, "linha é de outra loja");
});

await check("edita os dados da própria loja", async () => {
  const { data, error } = await ze
    .from("stores")
    .update({ description: "Editado pelo check-rls." })
    .eq("id", STORE_ZE)
    .select("id");
  assert(!error, error?.message ?? "");
  assert(data.length === 1, "update não atingiu a loja");
});

await check("NÃO ativa a própria loja", async () => {
  const { error } = await ze
    .from("stores")
    .update({ is_active: true })
    .eq("id", STORE_ZE);
  assert(error, "gerente conseguiu escrever em is_active");
  return error.code;
});

await check("NÃO mexe no status da assinatura", async () => {
  const { error } = await ze
    .from("stores")
    .update({ subscription_status: "active" })
    .eq("id", STORE_ZE);
  assert(error, "gerente conseguiu escrever em subscription_status");
  return error.code;
});

await check("NÃO edita a loja do vizinho", async () => {
  const { data, error } = await ze
    .from("stores")
    .update({ description: "invadido" })
    .eq("id", STORE_DIST)
    .select("id");
  assert(!error, error?.message ?? "");
  assert(data.length === 0, "gerente editou a loja de outro");
});

await check("cria produto na própria loja", async () => {
  const { data, error } = await ze
    .from("products")
    .insert({
      store_id: STORE_ZE,
      category_id: CAT_LANCHES,
      name: "Teste check-rls",
      price_cents: 100,
    })
    .select("id");
  assert(!error, error?.message ?? "");
  await ze.from("products").delete().eq("id", data[0].id);
});

await check("NÃO cria produto na loja do vizinho", async () => {
  const { error } = await ze
    .from("products")
    .insert({ store_id: STORE_DIST, name: "Invasor", price_cents: 100 });
  assert(error, "gerente inseriu produto em outra loja");
  return error.code;
});

await check("NÃO aponta produto para categoria de outra loja", async () => {
  const { error } = await ze.from("products").insert({
    store_id: STORE_ZE,
    category_id: "f1111111-1111-4111-8111-111111111111", // categoria da distribuidora
    name: "Categoria trocada",
    price_cents: 100,
  });
  assert(error, "FK composta não barrou a categoria de outra loja");
  return error.code;
});

await check("lê as próprias métricas", async () => {
  const { data, error } = await ze
    .from("events")
    .select("id")
    .eq("kind", "whatsapp_click");
  assert(!error, error?.message ?? "");
  assert(data.length > 0, "nenhum evento visível");
  return `${data.length} cliques`;
});

await check("NÃO lê as métricas do vizinho", async () => {
  const { data, error } = await ze
    .from("events")
    .select("id")
    .eq("store_id", STORE_DIST);
  assert(!error, error?.message ?? "");
  assert(data.length === 0, `vazou ${data.length} eventos de outra loja`);
});

await check("store_metrics conta os próprios eventos", async () => {
  const { data, error } = await ze.rpc("store_metrics", { target: STORE_ZE });
  assert(!error, error?.message ?? "");
  assert(data[0].whatsapp_clicks > 0, "nenhum clique contabilizado");
  return `${data[0].whatsapp_clicks} cliques, ${data[0].store_views} visitas`;
});

await check("store_metrics devolve zeros para a loja do vizinho", async () => {
  const { data, error } = await ze.rpc("store_metrics", { target: STORE_DIST });
  assert(!error, error?.message ?? "");
  assert(
    data[0].whatsapp_clicks === 0 && data[0].store_views === 0,
    "SECURITY INVOKER não segurou: vazou métrica de outra loja",
  );
});

console.log("\nBucket de imagens");

// PNG 1x1 válido — o bucket só aceita mime de imagem.
const PIXEL = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

function png() {
  return new Blob([PIXEL], { type: "image/png" });
}

const uploadedPaths = [];

await check("gerente envia foto para a pasta da própria loja", async () => {
  const path = `${STORE_ZE}/produtos/check-rls-${Date.now()}.png`;
  const { error } = await ze.storage
    .from("store-images")
    .upload(path, png(), { contentType: "image/png" });

  assert(!error, error?.message ?? "");
  uploadedPaths.push(path);
});

await check("NÃO envia foto para a pasta da loja do vizinho", async () => {
  const { error } = await ze.storage
    .from("store-images")
    .upload(`${STORE_DIST}/produtos/invasor.png`, png(), {
      contentType: "image/png",
    });

  assert(error, "gerente gravou na pasta de outra loja");
  return "bloqueado";
});

await check("NÃO envia foto para a raiz do bucket", async () => {
  // Sem prefixo de loja, storage_store_id() devolve null e a policy nega.
  const { error } = await ze.storage
    .from("store-images")
    .upload(`solto-${Date.now()}.png`, png(), { contentType: "image/png" });

  assert(error, "gerente gravou fora de qualquer pasta de loja");
  return "bloqueado";
});

await check("visitante lê a foto sem login", async () => {
  const { data, error } = await anon.storage
    .from("store-images")
    .download(uploadedPaths[0]);

  assert(!error, error?.message ?? "");
  assert(data.size > 0, "arquivo veio vazio");
});

await check("visitante NÃO envia foto", async () => {
  const { error } = await anon.storage
    .from("store-images")
    .upload(`${STORE_ZE}/produtos/anon.png`, png(), {
      contentType: "image/png",
    });

  assert(error, "anon gravou no bucket");
  return "bloqueado";
});

// Limpeza dos arquivos criados por este script.
if (uploadedPaths.length > 0) {
  await ze.storage.from("store-images").remove(uploadedPaths);
}

console.log("\nHorário de funcionamento");

await check("store_is_open responde para as duas lojas", async () => {
  const ze_ = await anon.rpc("store_is_open", { target: STORE_ZE });
  const dist = await anon.rpc("store_is_open", { target: STORE_DIST });
  assert(!ze_.error, ze_.error?.message ?? "");
  assert(!dist.error, dist.error?.message ?? "");
  return `Zé: ${ze_.data ? "aberta" : "fechada"}, Distribuidora: ${dist.data ? "aberta" : "fechada"}`;
});

await check("sexta 23h a Lanchonete do Zé está aberta", async () => {
  // 2026-09-04 é sexta. Faixa 18:00–02:00, então 23h local tem de dar aberta.
  const { data, error } = await anon.rpc("store_is_open", {
    target: STORE_ZE,
    at_time: "2026-09-04T23:30:00-03:00",
  });
  assert(!error, error?.message ?? "");
  assert(data === true, "deu fechada dentro do horário");
});

await check("sábado 01h ainda conta como a sexta", async () => {
  // A faixa da sexta cruza a meia-noite: 01h de sábado pertence a ela.
  const { data, error } = await anon.rpc("store_is_open", {
    target: STORE_ZE,
    at_time: "2026-09-05T01:00:00-03:00",
  });
  assert(!error, error?.message ?? "");
  assert(data === true, "faixa que cruza a meia-noite deu fechada");
});

await check("segunda-feira a Lanchonete do Zé está fechada", async () => {
  // 2026-09-07 é segunda, dia sem store_hours cadastrado.
  const { data, error } = await anon.rpc("store_is_open", {
    target: STORE_ZE,
    at_time: "2026-09-07T20:00:00-03:00",
  });
  assert(!error, error?.message ?? "");
  assert(data === false, "deu aberta num dia sem horário");
});

// --- resultado ---------------------------------------------------------------

console.log("");
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("Todas as verificações de RLS passaram.\n");
