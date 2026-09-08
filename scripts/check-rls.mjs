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
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

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

/**
 * Só para limpar o que este script escreveu.
 *
 * Uma verificação que só passa na primeira execução é uma armadilha: quem
 * rodar duas vezes seguidas vê "FALHA" e vai procurar um bug de RLS que não
 * existe. Mesmo motivo da limpeza dos arquivos no bucket, mais abaixo.
 */
function serviceClient() {
  return createClient(URL_, SERVICE, { auth: { persistSession: false } });
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

console.log("\nSinais de demanda");

// É por estes números que o próximo bairro vai ser escolhido. Se o browser
// escrevesse direto, qualquer um fabricaria demanda para o bairro que quisesse
// — e se lesse, o mapa de expansão do Petire seria público.

await check("anon não escreve sinal de demanda", async () => {
  const { error } = await anon
    .from("demand_signals")
    .insert({ kind: "search_empty", term: "pizza" });

  assert(error, "anon gravou em demand_signals");
  return "bloqueado";
});

await check("anon não lê sinal de demanda", async () => {
  const { data, error } = await anon.from("demand_signals").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou demand_signals");
  return "bloqueado";
});

await check("gerente logado também não enxerga", async () => {
  // O mapa de demanda é do Petire, não da loja. E o gerente que o lesse saberia
  // quais concorrentes convidar antes de nós.
  const { data, error } = await ze.from("demand_signals").select("id");
  assert(error || (data ?? []).length === 0, "gerente enxergou demand_signals");
  return "bloqueado";
});

await check("demand_summary não é executável pelo browser", async () => {
  const { error } = await anon.rpc("demand_summary", { window_days: 30 });
  assert(error, "anon executou demand_summary");
  return "bloqueado";
});

console.log("\nIndicações de loja");

// A fila de prospecção do Petire. Aberta a escrita, vira caixa de spam; aberta
// a leitura, é a lista de quem estamos prestes a abordar.

await check("anon não escreve indicação", async () => {
  const { error } = await anon
    .from("store_suggestions")
    .insert({ store_name: "Loja fantasma" });

  assert(error, "anon gravou em store_suggestions");
  return "bloqueado";
});

await check("anon não lê indicações", async () => {
  const { data, error } = await anon.from("store_suggestions").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou store_suggestions");
  return "bloqueado";
});

console.log("\nLevantamento de rua");

// A fila de prospecção é a lista de quem o Petire está prestes a abordar, com o
// estado de cada conversa. Nem o gerente nem o visitante têm o que fazer com
// ela — e o gerente que a lesse saberia quais concorrentes vamos convidar.

await check("anon não lê a prospecção", async () => {
  const { data, error } = await anon.from("prospects").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou prospects");
  return "bloqueado";
});

await check("gerente logado também não enxerga", async () => {
  const { data, error } = await ze.from("prospects").select("id");
  assert(error || (data ?? []).length === 0, "gerente enxergou prospects");
  return "bloqueado";
});

await check("gerente NÃO anota loja na fila", async () => {
  const { error } = await ze.from("prospects").insert({
    name: "Lanchonete inventada",
    city: "Juiz de Fora",
    neighborhood: "Benfica",
  });

  assert(error, "gerente escreveu em prospects");
  return "bloqueado";
});

await check("o slug do bairro é gerado pelo banco", async () => {
  // É o que casa o levantamento com as lojas que já existem. Deixar o app
  // calcular seria a mesma divergência que city_slug resolve em stores.
  const admin = serviceClient();
  const { data, error } = await admin
    .from("prospects")
    .insert({
      name: "Bar do Teste",
      city: "Juiz de Fora",
      neighborhood: "São Pedro",
    })
    .select("neighborhood_slug, status")
    .single();

  assert(!error, error?.message ?? "");
  assert(
    data.neighborhood_slug === "sao-pedro",
    `esperava sao-pedro, veio ${data.neighborhood_slug}`,
  );
  assert(
    data.status === "a_visitar",
    `esperava a_visitar, veio ${data.status}`,
  );

  await admin.from("prospects").delete().eq("name", "Bar do Teste");
  return data.neighborhood_slug;
});


console.log("\nMensalidade");

await check("gerente lê os próprios pagamentos", async () => {
  const { data, error } = await ze
    .from("subscription_payments")
    .select("id, amount_cents");
  assert(!error, error?.message ?? "");
  assert(data.length === 1, `esperava 1 pagamento, veio ${data.length}`);
  return `${data.length} pagamento`;
});

await check("gerente NÃO lê o pagamento do vizinho", async () => {
  // O pagamento do seed é da Lanchonete do Zé; a Distribuidora não pode vê-lo.
  const vizinho = await managerClient("distribuidora@petire.local");
  const { data, error } = await vizinho
    .from("subscription_payments")
    .select("id");
  assert(!error, error?.message ?? "");
  assert(data.length === 0, `vazou ${data.length} pagamento(s)`);
});

await check("gerente NÃO registra pagamento", async () => {
  // Assinatura nunca é editável pelo lojista, nem por esta porta.
  const { error } = await ze.from("subscription_payments").insert({
    store_id: STORE_ZE,
    amount_cents: 1,
    covers_until: "2030-01-01",
  });

  assert(error, "gerente gravou um pagamento");
  return "bloqueado";
});

await check("anon não lê pagamento de ninguém", async () => {
  const { data, error } = await anon.from("subscription_payments").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou pagamentos");
  return "bloqueado";
});

console.log("\nItens mais pedidos");

await check("store_top_products devolve o ranking da própria loja", async () => {
  const { data, error } = await ze.rpc("store_top_products", {
    target: STORE_ZE,
  });
  assert(!error, error?.message ?? "");
  assert(data.length > 0, "ranking veio vazio");

  // A função ordena por volume; se vier fora de ordem, o painel mente.
  const counts = data.map((row) => Number(row.adds));
  const sorted = [...counts].sort((a, b) => b - a);
  assert(
    JSON.stringify(counts) === JSON.stringify(sorted),
    "ranking não veio ordenado",
  );
  return `${data.length} itens, topo com ${counts[0]}`;
});

await check("store_top_products não vaza a loja do vizinho", async () => {
  const { data, error } = await ze.rpc("store_top_products", {
    target: STORE_DIST,
  });
  assert(!error, error?.message ?? "");
  assert(data.length === 0, `vazou ${data.length} linha(s)`);
});

console.log("\nFila de cadastro");

// A fila carrega e-mail e telefone de quem se candidatou, e é a lista de lojas
// prestes a entrar no catálogo.

await check("anon não escreve candidatura", async () => {
  const { error } = await anon.from("store_applications").insert({
    store_name: "Loja fantasma",
    manager_email: "a@b.com",
    whatsapp_e164: "5511987654321",
    city: "São Paulo",
    neighborhood: "Centro",
    kind: "food",
  });

  assert(error, "anon gravou em store_applications");
  return "bloqueado";
});

await check("anon não lê a fila", async () => {
  const { data, error } = await anon.from("store_applications").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou a fila");
  return "bloqueado";
});

await check("gerente logado também não lê a fila", async () => {
  const { data, error } = await ze.from("store_applications").select("id");
  assert(error || (data ?? []).length === 0, "gerente enxergou a fila");
  return "bloqueado";
});

console.log("\nPlano");

await check("gerente lê o próprio plano", async () => {
  const { data, error } = await ze
    .from("stores")
    .select("plan")
    .eq("id", STORE_ZE)
    .single();
  assert(!error, error?.message ?? "");
  return data.plan;
});

await check("gerente NÃO troca o próprio plano", async () => {
  // Privilégio de coluna, como subscription_status: quem muda o plano é quem
  // cobra por ele.
  const { error } = await ze
    .from("stores")
    .update({ plan: "plus" })
    .eq("id", STORE_ZE);

  assert(error, "gerente trocou o próprio plano");
  return "bloqueado";
});

await check("gerente enxerga só a equipe da própria loja", async () => {
  // A tela de equipe e a remoção de acesso dependem desta leitura. O alcance é
  // a própria loja: o gerente do Zé não pode listar quem cuida da vizinha.
  const { data, error } = await ze.from("managers").select("email, store_id");
  assert(!error, error?.message ?? "");
  assert(data.length > 0, "gerente não enxergou nem a própria linha");
  assert(
    data.every((row) => row.store_id === STORE_ZE),
    "vazou gerente de outra loja",
  );
  return `${data.length} da própria loja`;
});

await check("store_manager_limit responde pelo plano", async () => {
  const { data, error } = await ze.rpc("store_manager_limit", {
    target: STORE_ZE,
  });
  assert(!error, error?.message ?? "");
  assert(data === 1, `esperava 1 no plano básico, veio ${data}`);
  return `${data} login`;
});

console.log("\nRetenção de events");

await check("gerente lê o mês somado da própria loja", async () => {
  // Antes de somar não há linha nenhuma; o que interessa é que a leitura é
  // permitida e limitada à própria loja.
  const { data, error } = await ze
    .from("store_month_metrics")
    .select("store_id, month");
  assert(!error, error?.message ?? "");
  assert(
    (data ?? []).every((row) => row.store_id === STORE_ZE),
    "vazou mês somado de outra loja",
  );
  return `${(data ?? []).length} meses`;
});

await check("gerente NÃO escreve no mês somado", async () => {
  // A soma é da rotina de manutenção. Se o lojista pudesse escrever aqui, ele
  // reescreveria o próprio histórico — e é esse histórico que sustenta a
  // conversa de renovação.
  const { error } = await ze.from("store_month_metrics").insert({
    store_id: STORE_ZE,
    month: "2026-01-01",
    store_views: 99999,
  });

  assert(error, "gerente escreveu no mês somado");
  return "bloqueado";
});

await check("anon não lê mês somado de ninguém", async () => {
  const { data, error } = await anon
    .from("store_month_metrics")
    .select("store_id");
  assert(error || (data ?? []).length === 0, "anon enxergou o mês somado");
  return "bloqueado";
});

await check("maintain_events não é executável pelo browser", async () => {
  // Poda de dados: só a rotina do banco chama.
  const asAnon = await anon.rpc("maintain_events");
  const asManager = await ze.rpc("maintain_events");
  assert(asAnon.error, "anon executou maintain_events");
  assert(asManager.error, "gerente executou maintain_events");
  return "bloqueado nos dois";
});

console.log("\nResumo do cardápio no admin");

await check("gerente NÃO lê o resumo de todas as lojas", async () => {
  // A função é somada sobre a tabela inteira. Sem o `is_admin()` dentro dela,
  // um gerente receberia contagem e data de edição de todo cardápio público —
  // o ritmo de trabalho do concorrente, de bandeja.
  const { data, error } = await ze.rpc("store_menu_summary");
  assert(!error, error?.message ?? "");
  assert(
    (data ?? []).length === 0,
    `gerente enxergou ${(data ?? []).length} lojas no resumo`,
  );
  return "lista vazia";
});

await check("admin lê uma linha por loja com cardápio", async () => {
  const admin = await managerClient("admin@petire.local");
  const { data, error } = await admin.rpc("store_menu_summary");
  assert(!error, error?.message ?? "");
  assert(data.length > 0, "resumo veio vazio para o admin");

  // O ponto da função: uma linha por loja. Se voltasse uma por produto, o teto
  // de mil linhas do PostgREST voltaria junto.
  const lojas = new Set(data.map((row) => row.store_id));
  assert(
    lojas.size === data.length,
    "veio mais de uma linha para a mesma loja",
  );

  const ze_ = data.find((row) => row.store_id === STORE_ZE);
  assert(ze_, "a Lanchonete do Zé não apareceu no resumo");
  assert(Number(ze_.items) > 0, "contagem de itens veio zerada");
  return `${data.length} lojas, ${ze_.items} itens no Zé`;
});

console.log("\nLimite de itens do plano");

// O teto mora no banco, e não no app, para valer mesmo se amanhã alguém
// escrever outra tela que crie produto. Estas verificações são o que garante
// que ele continua valendo — inclusive na importação, que insere em lote.

const service = serviceClient();

await check("store_item_limit responde pelo plano", async () => {
  const { data, error } = await ze.rpc("store_item_limit", {
    target: STORE_ZE,
  });
  assert(!error, error?.message ?? "");
  assert(data === 100, `esperava 100 no plano básico, veio ${data}`);
  return `${data} itens`;
});

await check("gerente NÃO passa do teto criando um a um", async () => {
  // Enche até o limite com service_role e tenta o próximo pelo gerente.
  const { count } = await service
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", STORE_ZE);

  const missing = 100 - (count ?? 0);
  if (missing > 0) {
    const filler = Array.from({ length: missing }, (_, index) => ({
      store_id: STORE_ZE,
      name: `Enchimento ${index + 1}`,
      price_cents: 1000,
    }));
    const { error: fillError } = await service.from("products").insert(filler);
    assert(!fillError, fillError?.message ?? "");
  }

  const { error } = await ze
    .from("products")
    .insert({ store_id: STORE_ZE, name: "Passa do teto", price_cents: 1000 });

  assert(error, "gerente passou do teto do plano");
  assert(
    error.code === "PT422",
    `esperava o código PT422, veio ${error.code}`,
  );
  return "PT422";
});

await check("nem em lote, que é o caso do cardápio colado", async () => {
  // Um gatilho por linha não enxergaria as linhas anteriores do mesmo comando,
  // e o cardápio colado passaria direto. Por isso ele é por statement.
  const lote = Array.from({ length: 20 }, (_, index) => ({
    store_id: STORE_ZE,
    name: `Lote ${index + 1}`,
    price_cents: 1000,
  }));

  const { error } = await ze.from("products").insert(lote);
  assert(error, "lote passou do teto do plano");
  assert(error.code === "PT422", `esperava PT422, veio ${error.code}`);
  return "PT422";
});

await check("o plano de cima levanta o teto", async () => {
  await service.from("stores").update({ plan: "plus" }).eq("id", STORE_ZE);

  const { error } = await ze
    .from("products")
    .insert({ store_id: STORE_ZE, name: "Cabe no Plus", price_cents: 1000 });

  assert(!error, error?.message ?? "");

  // Devolve a loja ao estado do seed, para o script continuar repetível.
  await service.from("stores").update({ plan: "basico" }).eq("id", STORE_ZE);
  await service.from("products").delete().like("name", "Enchimento %");
  await service.from("products").delete().like("name", "Cabe no Plus");
  return "liberado";
});

console.log("\nConfirmação de pedidos");

// A semana confirmada é única por loja, e é isso que se quer. Limpar antes faz
// o bloco valer em qualquer execução, e não só logo depois de um db:reset.
await serviceClient()
  .from("order_confirmations")
  .delete()
  .eq("store_id", STORE_ZE);

await check("gerente confirma a semana da própria loja", async () => {
  // Segunda-feira qualquer, no passado.
  const { error } = await ze.from("order_confirmations").insert({
    store_id: STORE_ZE,
    week_start: "2026-08-24",
    confirmed: 9,
  });
  assert(!error, error?.message ?? "");
});

await check("o denominador não vem do formulário", async () => {
  // `opened` foi enviado como 999 e tem de ser sobrescrito pelo trigger, que
  // conta os eventos de verdade.
  const { error } = await ze.from("order_confirmations").insert({
    store_id: STORE_ZE,
    week_start: "2026-08-17",
    confirmed: 5,
    opened: 999,
  });

  // O grant de insert não inclui a coluna `opened`, então nem chega ao trigger.
  assert(error, "gerente escreveu opened");
  return "coluna bloqueada";
});

await check("gerente NÃO confirma pela loja do vizinho", async () => {
  const { error } = await ze.from("order_confirmations").insert({
    store_id: STORE_DIST,
    week_start: "2026-08-24",
    confirmed: 99,
  });

  assert(error, "gerente confirmou pela loja do vizinho");
  return "bloqueado";
});

await check("gerente NÃO edita uma confirmação já feita", async () => {
  // Sem policy de update: confirmação é registro do que aconteceu, não rascunho
  // ajustável depois de conhecido o resultado.
  const { data, error } = await ze
    .from("order_confirmations")
    .update({ confirmed: 1 })
    .eq("store_id", STORE_ZE)
    .select("id");

  assert(error || (data ?? []).length === 0, "gerente editou a confirmação");
  return "bloqueado";
});

await check("anon não lê confirmação de ninguém", async () => {
  const { data, error } = await anon.from("order_confirmations").select("id");
  assert(error || (data ?? []).length === 0, "anon enxergou confirmações");
  return "bloqueado";
});

// --- resultado ---------------------------------------------------------------

console.log("");
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.\n`);
  process.exit(1);
}
console.log("Todas as verificações de RLS passaram.\n");
