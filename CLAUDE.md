# Petire

Cardápios das lanchonetes e distribuidoras do bairro. O cliente monta o pedido
no site e fecha no WhatsApp da loja: sem cadastro, sem taxa, sem pagamento pelo
site. A loja paga uma mensalidade fixa.

Antes de mudar comportamento, leia a spec. Se a mudança contradiz o que está
escrito, a spec é atualizada no mesmo PR, ou a mudança não entra.

| Assunto | Onde está |
|---|---|
| Escopo, decisões fechadas, modelo de dados, rotas | `docs/MVP.md` |
| Formato da mensagem do WhatsApp | `docs/MVP.md` §5 |
| Planos, limites e preço | `docs/precos.md` |
| Como uma loja real entra no ar | `docs/onboarding.md` |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth,
Storage, RLS) · Vercel (`gru1`) · Vitest · Playwright.

## Quem usa o quê

| Área | Rota | Quem |
|---|---|---|
| Vitrine e carrinho | `src/app/(site)` | cliente, sem login |
| Painel da loja | `src/app/gerente` | gerente da loja |
| Operação | `src/app/admin` | suporte do Petire |

Lógica pura fica em `src/lib`, com o teste ao lado (`x.ts` → `x.test.ts`).

## Comandos

```bash
npm run db:start       # Supabase local (Docker)
npm run db:reset       # recria o banco, aplica migrations e seed
npm run dev
npm run lint && npm run typecheck && npm test
npm run check:rls      # depois de qualquer mudança em policy
npm run test:e2e       # jornadas completas (cliente, lojista, suporte)
npm run db:types       # depois de qualquer migration
```

## Regras

**Banco**
- Toda mudança de banco é uma migration nova em `supabase/migrations`. Nunca
  editar uma migration que já foi aplicada.
- **Migrations são aditivas.** Produção recebe a migration pelo workflow no
  push para `main`, ao mesmo tempo que a Vercel publica o código. Remover ou
  renomear algo em uso é feito em duas entregas: primeiro o código para de
  usar, depois a coluna sai.
- Depois de mudar o schema, rodar `db:types` e commitar o
  `database.types.ts` gerado.

**Acesso**
- RLS é a proteção principal. Bug de RLS é silencioso: uma loja passa a ver o
  cardápio da outra e nada quebra. Policy nova ou alterada exige um caso novo
  em `scripts/check-rls.mjs`.
- `src/lib/supabase/admin.ts` usa a chave `service_role` e **ignora RLS**. Só
  entra no painel `/admin`, no cadastro e na indicação de loja e nas rotas de
  métrica e demanda (`src/app/api`). Nunca importar de Client Component.

**Dados**
- Dinheiro é sempre `INTEGER` em centavos, do banco até a tela. Conversão só
  por `src/lib/money.ts`.
- O cliente não tem conta. Não pedir CPF, e-mail ou senha a ele. Nome,
  telefone e endereço só existem para montar a mensagem do pedido.

**Importação de cardápio**
- O texto ou o JSON vindo de IA nunca é gravado direto: sempre passa pela tela
  de conferência.
- O prompt (`menu-import-prompt.ts`) e o schema (`menu-import.ts`) mudam
  juntos, no mesmo commit. Prompt desatualizado gera JSON que a tela recusa
  sem explicar por quê.

## Antes de abrir PR

1. `lint`, `typecheck` e `test` passando.
2. Mexeu em policy: `check:rls`. Mexeu em fluxo de cliente ou lojista:
   `test:e2e`.
3. Doc atualizada se a decisão mudou.
4. Nada de `.env.local`, chave ou dado real de loja no commit.

@AGENTS.md
