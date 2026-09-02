# Petire

Do latim *petire*, pedir.

Cardápios das lanchonetes e distribuidoras do bairro. O cliente monta o pedido
no site e fecha direto no WhatsApp da loja — sem taxa de serviço, sem cadastro,
sem dados de pagamento. A loja paga uma mensalidade fixa para estar no catálogo.

- Conceito: [docs/Petire CoreV1.txt](docs/Petire%20CoreV1.txt)
- Escopo e modelo de dados do MVP: [docs/MVP.md](docs/MVP.md)

## Stack

| Camada | Escolha |
|---|---|
| Front | Next.js 16 (App Router) + TypeScript + Tailwind 4 |
| Backend | Supabase — Postgres, Auth, Storage, RLS |
| Deploy | Vercel |

## Rodando local

Requisitos: Node 20+, Docker rodando.

```bash
npm install
npm run db:start
```

`db:start` sobe o Supabase local e imprime a URL e as chaves. Copie
`.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | linha `API URL` do `db:start` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | linha `anon key` |
| `SUPABASE_SERVICE_ROLE_KEY` | linha `service_role key` |

Depois:

```bash
npm run db:reset
npm run dev
```

`db:reset` recria o banco do zero, aplica as migrations e roda o seed.

### Logins do seed

Senha de todos: `petire123`

| E-mail | Papel |
|---|---|
| `gerente@petire.local` | gerente da Lanchonete do Zé |
| `distribuidora@petire.local` | gerente da Distribuidora do Bairro |
| `admin@petire.local` | admin do Petire |

O Supabase Studio local fica em <http://127.0.0.1:54323> e o Mailpit (e-mails de
teste) em <http://127.0.0.1:54324>.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | testes da lógica pura (dinheiro, promoções, mensagem do pedido) |
| `npm run check:rls` | exercita as políticas de RLS contra o banco local |
| `npm run db:start` / `db:stop` | sobe/derruba o Supabase local |
| `npm run db:reset` | recria o banco, aplica migrations e seed |
| `npm run db:diff` | gera migration a partir de mudanças no Studio |
| `npm run db:push` | aplica migrations no projeto remoto |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |

Rode `npm run db:types` sempre que mexer no schema — os tipos do banco não são
inferidos em tempo de build.

## Como o acesso é controlado

Quatro clientes Supabase, quatro níveis de poder:

| Arquivo | Papel no banco | Onde usar |
|---|---|---|
| `src/lib/supabase/client.ts` | `anon` / `authenticated` | Client Components |
| `src/lib/supabase/server.ts` | `anon` / `authenticated` | Server Components, actions, route handlers |
| `src/lib/supabase/admin.ts` | `service_role` — **ignora RLS** | só `/admin` e `/api/events` |
| `src/lib/supabase/public.ts` | `anon`, sem cookies | vitrine pública, sitemap, build |

Regras que valem a pena ter na cabeça:

- **O gerente não consegue ativar a própria loja nem mexer na assinatura.** Isso
  não é uma policy, é privilégio de coluna: `is_active`, `subscription_status` e
  `subscription_until` não estão no `GRANT UPDATE` de `authenticated`.
- **`events` não aceita escrita do browser.** Métricas passam por
  `/api/events` com `service_role`. Insert anônimo direto deixaria qualquer um
  inflar os números que justificam a mensalidade da loja.
- **`src/proxy.ts` é filtro otimista**, só renova a sessão e redireciona. A
  autorização real é `requireManager()` em `src/lib/auth.ts`, chamada pelos
  layouts.
- **O visitante não enxerga a assinatura de ninguém.** `subscription_status` e
  `subscription_until` saíram do `GRANT SELECT` de `anon`; a vitrine lê a view
  `stores_public`, que resolve "está aberta?" e omite essas colunas.
- **Dinheiro é sempre `integer` em centavos**, do Postgres até a tela. As
  conversões ficam em `src/lib/money.ts`.

Bug de RLS não quebra nada — só faz uma loja enxergar o cardápio da outra. Por
isso `npm run check:rls` existe: ele exercita os caminhos que *precisam* falhar.
Rode depois de mexer em qualquer policy.

## Estrutura

```
docs/                     conceito e especificação do MVP
supabase/
  migrations/             schema, RLS, storage, views públicas
  seed.sql                dados de desenvolvimento
src/
  app/
    (site)/               vitrine pública
      page.tsx            home, seletor de bairro
      lojas/              lista com filtros
      loja/[slug]/        cardápio — a página de SEO
      carrinho/           carrinho multi-loja e envio
    entrar/               login do lojista
    gerente/              painel (protegido)
      cardapio/           categorias, itens, opções, fotos
      loja/               dados, horários, abrir/fechar
    api/events/           gravação de métricas
    sitemap.ts robots.ts
  components/ui.tsx       primitivas visuais do painel
  lib/
    auth.ts               requireManager / requireAdmin
    env.ts                leitura das variáveis de ambiente
    cart.ts               carrinho no localStorage
    money.ts              centavos ↔ texto
    order-message.ts      texto do pedido e link do wa.me
    promotions.ts         preço com desconto aplicado
    storefront.ts         tipos das views públicas
    validation.ts         schemas zod dos formulários
    weekdays.ts           dias da semana e horário
    supabase/             os quatro clientes + tipos gerados
  proxy.ts                refresh de sessão e redirect otimista
scripts/
  check-rls.mjs           testes das políticas de acesso
```

## Como a vitrine se mantém fresca

`/loja/[slug]` é gerada estaticamente. Um cardápio desatualizado é o que mais
rápido queima a confiança do cliente, então a página não espera o `revalidate`
de uma hora: toda ação do painel que muda o cardápio chama
`revalidatePath('/loja/<slug>')`. Ver `refreshMenu()` em
`src/app/gerente/cardapio/actions.ts`.

Por isso `requireManager()` devolve `storeSlug` — a action precisa saber qual
página pública invalidar.

O `src/proxy.ts` roda só em `/gerente`, `/admin` e `/entrar`. A vitrine é
anônima: rodar o proxy nela custaria uma ida ao Supabase por página vista só
para descobrir, toda vez, que não há ninguém logado.

## O carrinho e o pedido

O carrinho vive no `localStorage` — o Petire não tem cadastro, então não há
onde guardar isso no servidor nem por quê. Mas ele guarda só a **identidade**
do pedido: qual produto, quais opções, quantas unidades. Nunca preço, nome de
loja ou número de WhatsApp.

Preço, disponibilidade, taxa de entrega e telefone são relidos do banco em
`resolveCart()` toda vez que o carrinho é aberto. Um carrinho de ontem não pode
cobrar o preço de ontem, e muito menos mandar o pedido para um número que a
loja já trocou. Item que saiu do cardápio ou esgotou é removido, com aviso.

Cada loja é um envio separado, porque cada uma tem o próprio WhatsApp. Enviar o
pedido da lanchonete não pode levar junto o da distribuidora.

O `wa.me` carrega a mensagem na query string, e estourar o limite de URL **não
dá erro** — o WhatsApp simplesmente abre com o texto cortado e a loja recebe
meio pedido. Por isso `buildOrderMessage()` monta o texto em três níveis de
detalhe e usa o mais rico que couber em 1500 caracteres. É o que
`src/lib/order-message.test.ts` cobre.

## Fotos do cardápio

O browser envia direto para o Storage — a policy do bucket já limita o gerente
à pasta `<store_id>/`, então os bytes não precisam passar pelo servidor do Next.
O formulário carrega só a URL.

Os `remotePatterns` de `next.config.ts` são literais de propósito. Derivá-los de
`NEXT_PUBLIC_SUPABASE_URL` funciona no build, mas o valor não chega ao processo
que atende `/_next/image`, e o sintoma é um `400 "url" parameter is not allowed`
sem nenhuma pista da causa.

## Onde o MVP está

| Fase | Status |
|---|---|
| 0 — schema, RLS, auth, seed | pronta |
| 1 — painel do gerente (cardápio, opções, fotos, horários) | pronta |
| 2 — vitrine pública, SEO, métricas | pronta |
| 3 — carrinho, opções e checkout no WhatsApp | pronta |
| 4 — PWA, painel admin, deploy | a fazer |
