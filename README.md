# Petire

Do latim *petire*, pedir.

Cardápios das lanchonetes e distribuidoras do bairro. O cliente monta o pedido
no site e fecha direto no WhatsApp da loja — sem taxa de serviço, sem cadastro,
sem dados de pagamento. A loja paga uma mensalidade fixa para estar no catálogo.

- Conceito: [docs/Petire CoreV1.txt](docs/Petire%20CoreV1.txt)
- Escopo e modelo de dados do MVP: [docs/MVP.md](docs/MVP.md)
- Como colocar uma loja real no ar: [docs/onboarding.md](docs/onboarding.md)

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
| `npm test` | testes da lógica pura (dinheiro, promoções, proximidade, importação, mensagem do pedido) |
| `npm run check:rls` | exercita as políticas de RLS contra o banco local |
| `npm run db:start` / `db:stop` | sobe/derruba o Supabase local |
| `npm run db:reset` | recria o banco, aplica migrations e seed |
| `npm run db:diff` | gera migration a partir de mudanças no Studio |
| `npm run db:push` | aplica migrations no projeto remoto |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `node scripts/make-icons.mjs` | regera os ícones do PWA |

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
- **Tirar uma loja do ar invalida a página dela na hora.** Sem isso a versão
  estática seguiria servindo até o backstop de uma hora, e uma loja suspensa
  continuaria recebendo pedido. Ver `refreshStorefront()` em
  `src/app/admin/actions.ts`.

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
    admin/                cadastro, edição e assinatura das lojas
    entrar/               login do lojista
    gerente/              painel (protegido)
      cardapio/           categorias, itens, opções, fotos
        importar/         cardápio colado como texto
      promocoes/          descontos por item ou no cardápio todo
      divulgar/           link, mensagem pronta e cartaz com QR
      loja/               dados, horários, abrir/fechar
    api/events/           gravação de métricas
    offline/              fallback do service worker
    manifest.ts           manifesto do PWA
    sitemap.ts robots.ts
  components/
    address-fields.tsx    endereço com busca por CEP
    location-bar.tsx      barra de CEP do cliente
    ui.tsx                primitivas visuais do painel
  lib/
    auth.ts               requireManager / requireAdmin
    env.ts                leitura das variáveis de ambiente
    cart.ts               carrinho no localStorage
    cep.ts                consulta ao ViaCEP
    customer-contact.ts   nome e número de quem recebe, só no browser dele
    customer-location.ts  CEP do cliente, só no browser dele
    delivery.ts           tempo de entrega, do jeito que o cliente lê
    slug.ts               normalização, gêmea da do banco
    money.ts              centavos ↔ texto
    order-message.ts      texto do pedido e link do wa.me
    menu-import.ts        lê o cardápio colado como texto
    promotions.ts         preço com desconto e janela de vigência
    proximity.ts          distância estimada pelo CEP
    qr.ts                 QR code da loja, em SVG
    storefront.ts         tipos das views públicas
    validation.ts         schemas zod dos formulários
    weekdays.ts           dias da semana e horário
    supabase/             os quatro clientes + tipos gerados
  proxy.ts                refresh de sessão e redirect otimista
public/
  sw.js                   service worker
  icon-*.png              ícones do PWA (gerados)
scripts/
  check-rls.mjs           testes das políticas de acesso
  make-icons.mjs          desenha os ícones
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

## O CEP do cliente

A home pede o CEP num campo em destaque, e a barra no topo o acompanha pelo
resto do site — ela se cala na home enquanto o CEP não veio, porque dois campos
pedindo a mesma coisa na mesma tela só criam a dúvida de qual dos dois vale.

Antes a home pedia o **bairro**, numa lista. Bairro sem CEP resolve metade do
problema: encontra a loja, mas não preenche o endereço da entrega, e o cliente
teria de informar o CEP no passo seguinte de qualquer jeito. A lista continua
lá, mais discreta, por dois motivos — quem não quer digitar o CEP tem por onde
entrar, e são esses links que dão ao Google um caminho para cada cidade e
bairro atendidos. Ele resolve duas coisas de uma vez:
encontrar as lojas e preencher o endereço de entrega.

A caixa do CEP nasce **aberta** para quem ainda não informou. Um link
"Informe seu CEP" cobrava um toque a mais para chegar ao mesmo campo — e é o
primeiro toque de quem acabou de chegar no site. Ela só encolhe depois, quando
já existe um CEP para mostrar.

**Encontrar as lojas.** O CEP dá o município, e é por ele que a lista filtra —
não pelo bairro. Numa cidade média a lanchonete do Centro entrega no bairro
vizinho sem pensar duas vezes; casar bairro com bairro mostraria "nenhuma
loja" numa cidade que tem lojas, e o cliente não voltaria. Dentro da cidade, o
bairro e o CEP só **ordenam**.

**Da mais perto para a mais longe.** Não há coordenada de ninguém: o ViaCEP
devolve endereço, não latitude, e cidade pequena — o mercado do Petire — é a
que os geocodificadores conhecem pior. O que existe nos dois cadastros é o CEP,
e no Brasil ele é hierárquico: os cinco primeiros dígitos vão de região a
divisor de subsetor. Compartilhar mais dígitos iniciais é estar em área mais
aninhada, logo mais perto (`src/lib/proximity.ts`). O bairro igual ganha do
CEP, porque é a única afirmação direta de lugar; o resto é inferência sobre a
numeração dos Correios, e a tela diz isso ao cliente.

A ordenação roda **no browser**, em `StoreList`. O servidor entrega uma ordem
que já serve sozinha — abertas antes de fechadas, e as do bairro do `perto`
primeiro — e é ela que vale na primeira pintura e sem JavaScript. Mandar o CEP
para o servidor, ou pior para a query string, que é compartilhável e
indexável, transformaria em dado de cadastro o que hoje não sai do aparelho.

**Preencher o endereço.** Rua, bairro, cidade e CEP já vão escritos na
mensagem do WhatsApp. O que nenhum CEP sabe — quem recebe, o número e o
complemento — é perguntado numa tela antes do envio, e não no meio da conversa
com a loja esperando, que é onde o pedido esfria. Essas três respostas ficam no
aparelho do cliente (`src/lib/customer-contact.ts`), então o segundo pedido
custa um toque.

**Pagamento não entra na mensagem.** Quem cobra é a loja, e ela pergunta do
jeito dela. O Petire não vê dinheiro nenhum e não deveria dar a entender que
vê.

O CEP fica **só no browser do cliente** (`src/lib/customer-location.ts`).
Endereço residencial é dado pessoal, o Petire não tem cadastro e não tem por
que guardar isso. Por isso `resolveCart()` devolve o número do WhatsApp em vez
do link pronto: a mensagem é montada no cliente e vai do aparelho dele direto
para a loja.

`slugify()` existe em duas cópias, `src/lib/slug.ts` e `public.slugify()` no
banco, e elas **precisam** concordar — é o que faz o CEP do cliente encontrar
as lojas da cidade dele.

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

## Endereço das lojas

O cliente só acha a loja se o bairro dele e o bairro da loja forem a mesma
coisa. Com texto livre não são: "Vila Madalena" e "vila madalena" viram dois
bairros na home, e a busca separa as lojas. São duas defesas, e as duas fazem
falta.

**Na entrada, o CEP.** `src/lib/cep.ts` consulta o ViaCEP e preenche endereço,
bairro, cidade, UF e o **código IBGE do município** — que é o identificador
canônico da cidade e não depende de grafia. Cidade e UF ficam travadas depois
da consulta.

Cidade pequena tem CEP único e volta **sem bairro e sem logradouro** — e cidade
pequena é justamente o mercado do Petire. Por isso o bairro continua editável,
e por isso a segunda defesa não é opcional.

**Na saída, colunas geradas pelo banco.** `city_slug` e `neighborhood_slug` são
`GENERATED ALWAYS` a partir de `public.slugify()`. O app não tem como esquecer
de atualizar, nem uma edição no painel do lojista tem como recriar a
divergência. Filtros, home e sitemap agrupam por esses slugs; o nome exibido é
a grafia mais usada entre as lojas do bairro (`mode()`).

## Trocar o apelido de uma loja

O admin edita a loja em `/admin/loja/[id]`, inclusive o apelido (slug). Só que
o slug é a URL pública: é o que o Google indexou e o link que o cliente salvou
no WhatsApp. Trocar sem mais nada transforma os dois em 404 silencioso.

Por isso existe `store_slug_history`. Ao trocar, o apelido antigo entra na
tabela e `/loja/[slug]` passa a redirecionar permanentemente para o atual em
vez de dar 404. O apelido novo é removido do histórico na mesma operação —
sem isso, renomear e voltar atrás criaria um ciclo de redirecionamento.

## Apagar uma loja

`/admin/loja/[id]` tem exclusão, com confirmação por digitação do apelido. O
botão desabilitado é fricção, não segurança — o servidor confere de novo.

O cascade do banco leva cardápio, opções, promoções, horários, métricas e a
linha em `managers`. Mas duas coisas ficam fora do alcance dele, e sem elas a
exclusão seria só parcial:

- o usuário em `auth.users` — o lojista continuaria conseguindo entrar;
- as fotos no Storage — continuariam ocupando espaço pago, sem nada
  apontando para elas.

As duas são apagadas explicitamente em `deleteStore()`. Os gerentes precisam
ser lidos **antes** do delete: depois dele a linha em `managers` já não existe
e não haveria como achar o usuário de auth.

## Opções de item: uma ou várias

O banco guarda a regra do grupo de opções como `min_select`/`max_select`, mas
ninguém atrás de um balcão pensa assim. O painel pergunta duas coisas — o
cliente marca **uma** opção ou **várias**? é obrigatório? — e
`optionGroupSchema` converte para os dois números. "Obrigatório" não tem coluna
própria de propósito: é `min_select >= 1`, e uma coluna `required` acabaria
divergindo dela.

Escolha única é `max_select = 1`, e é o que impede o cliente de pedir a batata
pequena *e* a grande no mesmo item. Na vitrine ela vira `radio`; múltipla, com
o limite, vira `checkbox`.

Dois detalhes que o formulário de dois campos numéricos escondia:

- **A regra é editável.** Sem isso, corrigir um "Tamanho" cadastrado como
  múltipla escolha exigiria apagar o grupo — e com ele todas as opções já
  digitadas.
- **Grupo opcional de escolha única dá para desmarcar.** Um `radio` já marcado
  não dispara `change`, então o clique é tratado à parte em `menu-item.tsx`.
  Sem isso, marcar o tamanho grande num grupo opcional seria irreversível.

## Promoções

`/gerente/promocoes`. Desconto em percentual ou valor fixo, no cardápio inteiro
ou em um item, com dia para começar e acabar.

Três decisões que estão no código:

- **Promoção de item ganha da promoção da loja, e elas não somam** (`priceOf`).
  Duas promoções empilhando é como se zera uma margem sem perceber, e o lojista
  não tem como auditar isso pelo painel.
- **O dia final conta inteiro.** O lojista lê "até dia 30" como o dia 30 todo,
  mas `ends_at` é exclusivo — então a data vira a meia-noite do dia seguinte,
  no fuso de Brasília, o mesmo que `store_is_open()` usa. Sem fixar o fuso,
  `new Date("2026-09-30")` seria meia-noite em UTC e a promoção começaria às
  21h do dia 29.
- **Pausar em vez de apagar.** A promoção de sexta volta na sexta seguinte, e
  refazer a mesma janela toda semana é o tipo de trabalho que o lojista
  abandona.

Salvar revalida `/loja/<slug>` na hora. O que a revalidação não alcança é a
promoção **agendada**: ela entra sozinha quando a hora chega, e até lá nada
dispara um novo render — por isso o formulário avisa que ela pode levar até uma
hora (o `revalidate` de `/loja/[slug]`) para aparecer.

## Formulários e o reset do React 19

Quando uma Server Action passada em `<form action>` termina, o React reseta os
campos não-controlados — **inclusive quando ela termina em erro de validação**.
Sem tratar isso, uma vírgula errada no preço apaga tudo que a pessoa acabou de
digitar.

Por isso `FormState` carrega `values`: a action devolve o que foi enviado e o
formulário usa como `defaultValue`. Como o reset leva o campo de volta ao
`defaultValue`, ele cai exatamente no que a pessoa tinha escrito.

## Fotos do cardápio

O browser envia direto para o Storage — a policy do bucket já limita o gerente
à pasta `<store_id>/`, então os bytes não precisam passar pelo servidor do Next.
O formulário carrega só a URL.

Os `remotePatterns` de `next.config.ts` são literais de propósito. Derivá-los de
`NEXT_PUBLIC_SUPABASE_URL` funciona no build, mas o valor não chega ao processo
que atende `/_next/image`, e o sintoma é um `400 "url" parameter is not allowed`
sem nenhuma pista da causa.

## Instalável

`src/app/manifest.ts` e `public/sw.js` fazem o Petire virar app instalável.
Os ícones são gerados por `node scripts/make-icons.mjs`, que desenha a marca
geometricamente — sem dependência de imagem e com resultado igual em qualquer
máquina.

O service worker **nunca serve HTML do cache**. Um app de delivery com cardápio
velho é pior do que um app que não abre: o cliente pediria um item que acabou
há duas horas e só descobriria quando a loja respondesse. Navegação é sempre
rede; sem rede, aparece `/offline`. O cache guarda só o que não envelhece — os
assets do Next, que têm hash no nome.

Em desenvolvimento o service worker não é registrado: ele interceptaria os
assets do Turbopack e o hot reload passaria a servir versão velha.

## Publicando

### Supabase

1. Crie o projeto em <https://supabase.com/dashboard>.
2. Ligue o repositório local ao projeto e suba o schema:

```bash
npx supabase link --project-ref <project-ref>
npm run db:push
```

`db:push` aplica as migrations. **Não rode o seed em produção** — ele cria
usuários com senha conhecida.

3. Crie o primeiro admin. Pelo painel do Supabase, em Authentication, adicione
   um usuário e depois, no SQL Editor:

```sql
insert into public.managers (id, store_id, role, email)
values ('<uuid-do-usuario>', null, 'admin', '<seu-email>');
```

A partir daí, as lojas são cadastradas por `/admin`.

### Vercel

Importe o repositório e configure as variáveis:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role — **só em Production/Preview, nunca exposta** |
| `NEXT_PUBLIC_SITE_URL` | `https://<seu-dominio>` |

`NEXT_PUBLIC_SITE_URL` alimenta canonical, sitemap e JSON-LD. Deixar o valor
padrão de `localhost` em produção faz o Google indexar URLs que não existem.

O `next.config.ts` só libera `*.supabase.co` para o otimizador de imagem em
produção — os padrões de `127.0.0.1` ficam de fora do build de produção.

## Onde o MVP está

| Fase | Status |
|---|---|
| 0 — schema, RLS, auth, seed | pronta |
| 1 — painel do gerente (cardápio, opções, promoções, fotos, horários) | pronta |
| 2 — vitrine pública, SEO, métricas | pronta |
| 3 — carrinho, opções e checkout no WhatsApp | pronta |
| 4 — PWA, painel admin, deploy | pronta |
| 5 — onboarding das primeiras lojas | em andamento |
