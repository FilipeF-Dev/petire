# Petire

Do latim *petire*, pedir.

Cardápios das lanchonetes e distribuidoras do bairro. O cliente monta o pedido
no site e fecha direto no WhatsApp da loja — sem taxa de serviço, sem cadastro,
sem dados de pagamento. A loja paga uma mensalidade fixa para estar no catálogo.

- Conceito: [docs/Petire CoreV1.txt](docs/Petire%20CoreV1.txt)
- Escopo e modelo de dados do MVP: [docs/MVP.md](docs/MVP.md)
- Como colocar uma loja real no ar: [docs/onboarding.md](docs/onboarding.md)
- Preço, planos e o porquê de cada número: [docs/precos.md](docs/precos.md)
- O que a marca diz, e com que palavras: [docs/marca.md](docs/marca.md)
- Onde gastar atenção e dinheiro: [docs/marketing.md](docs/marketing.md)
- Onde abrir primeiro: [docs/bairro-de-estreia.md](docs/bairro-de-estreia.md)

## Stack

| Camada | Escolha |
|---|---|
| Front | Next.js 16 (App Router) + TypeScript + Tailwind 4 |
| Backend | Supabase — Postgres, Auth, Storage, RLS |
| Deploy | Vercel |

## Rodando local

Requisitos: Node 22+, Docker rodando.

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

## Deploy e migrations

O deploy do código sempre foi automático; o do banco era manual. Bastou esquecer
um `db:push` para o site subir pedindo uma coluna que o banco ainda não tinha —
e o sintoma foi o carrinho do cliente sendo apagado. Agora os dois andam juntos.

| Workflow | Quando roda | O que faz |
|---|---|---|
| `.github/workflows/ci.yml` | todo PR e todo push em `main` | lint, tipos, testes; e um banco levantado do zero **só a partir das migrations**, com `check:rls` e o build por cima dele |
| `.github/workflows/db-migrate.yml` | push em `main` que toque `supabase/migrations/**`, ou manualmente | `supabase db push` no projeto de produção |

O job `banco` do CI é o que mais protege: se uma migration não aplicar numa base
limpa, ou se o código passar a depender de algo que nenhuma migration cria, ele
falha no PR — não em produção.

### Segredos que o repositório precisa

Em **Settings → Secrets and variables → Actions**:

| Segredo | Onde encontrar |
|---|---|
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string, com a senha no lugar de `[YOUR-PASSWORD]` |

Um só, e é de propósito. Antes eram três, e um deles era um **token pessoal**:
o `supabase link` pergunta à API da plataforma qual é a conexão do projeto, e
para isso precisa de uma conta. O resultado é que o deploy do banco passava a
depender de uma pessoa — o token expira, perde privilégio quando o papel na
organização muda, e some junto com quem o criou. Foi assim que as migrations
ficaram dois dias sem subir enquanto o código continuava subindo, e as lojas
passaram uma tarde no ar sem cardápio.

O `db push` conversa direto com o Postgres. Se a string conecta, a migration
aplica.

> **A senha vai percent-encoded.** É uma URL: uma senha com `@`, `#`, `/` ou
> `:` quebra o endereço em silêncio, e o erro que aparece é de conexão, não de
> senha. `@` vira `%40`, `#` vira `%23`, `/` vira `%2F`, `:` vira `%3A`.

> Se o job falhar por não alcançar o banco, troque a string pela do **Session
> pooler** (a mesma página, porta 5432). A conexão direta do Supabase é IPv6, e
> nem todo runner do GitHub tem IPv6 — o pooler responde em IPv4. O que **não**
> serve é a de *Transaction pooler*: migration é DDL em transação.

### Quando falha, alguém fica sabendo

Falha nesta rotina abre uma **issue** no repositório, com o commit e o link da
execução. Se já houver uma aberta, ela ganha um comentário em vez de virar uma
segunda — três falhas seguidas são um problema, não três.

Isso existe porque a rotina já parou por dois dias sem ninguém notar, enquanto
o deploy do código continuava subindo: as lojas passaram uma tarde no ar sem
cardápio, e o que descobriu a falha foi alguém abrir o histórico de execuções
por acaso.

### A ordem, e por que ela é segura

A Vercel também dispara no push para `main`, então o deploy do código e o das
migrations correm juntos. Isso é seguro por uma razão só, e ela precisa ser
mantida de propósito:

**As migrations do Petire são aditivas.** Coluna, tabela, função e policy novas.
Código antigo ignora coluna nova, então o banco adiantado nunca quebra o site —
só o contrário quebra, que é o caso que este pipeline elimina.

Se um dia for preciso remover ou renomear algo que está em uso, a mudança tem de
ser partida em duas entregas: primeiro o código para de usar, depois a coluna
sai. Não há atalho, e juntar as duas num commit só reintroduz exatamente o bug
que motivou tudo isto.

## Como o acesso é controlado

Quatro clientes Supabase, quatro níveis de poder:

| Arquivo | Papel no banco | Onde usar |
|---|---|---|
| `src/lib/supabase/client.ts` | `anon` / `authenticated` | Client Components |
| `src/lib/supabase/server.ts` | `anon` / `authenticated` | Server Components, actions, route handlers |
| `src/lib/supabase/admin.ts` | `service_role` — **ignora RLS** | só `/admin`, `/api/events`, `/api/demand` e a indicação de loja |
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
      page.tsx            home, CEP, "peça novamente"
      lojas/              lista com filtros e indicação de loja
      loja/[slug]/        cardápio — a página de SEO
        menu-browser.tsx  índice de categorias e busca no cardápio
      carrinho/           carrinho multi-loja e envio
      cadastrar/          autocadastro da loja, público
    admin/                cadastro, edição e assinatura das lojas
      demand.tsx          demanda não atendida e lojas indicadas
      loja/[id]/payments.tsx  registro da mensalidade e histórico
      pedidos/            fila de aprovação das candidaturas
    entrar/               login do lojista
    gerente/              painel (protegido)
      cardapio/           categorias, itens, opções, fotos
        importar/         cardápio colado como texto
      promocoes/          descontos por item ou no cardápio todo
      divulgar/           link, mensagem pronta e cartaz com QR
      relatorio/          o mês fechado, para guardar (plano Plus)
      equipe/             acessos da loja (plano Plus)
      loja/               dados, horários, abrir/fechar
    api/events/           gravação de métricas
    api/demand/           demanda que o catálogo não atendeu
    offline/              fallback do service worker
    manifest.ts           manifesto do PWA
    sitemap.ts robots.ts
  components/
    address-fields.tsx    endereço com busca por CEP
    install-prompt.tsx    convite a instalar, só para quem já pediu
    location-bar.tsx      barra de endereço do cliente
    place-picker.tsx      lista de endereços salvos
    order-again.tsx       lojas de onde o cliente já pediu
    track-demand.tsx      busca vazia e cidade sem loja
    ui.tsx                primitivas visuais do painel
    use-cep-lookup.ts     consulta de CEP, compartilhada pelas três telas
  lib/
    auth.ts               requireManager / requireAdmin
    env.ts                leitura das variáveis de ambiente
    cart.ts               carrinho no localStorage
    cep.ts                consulta ao ViaCEP
    customer-contact.ts   chave antiga de contato, só para migrar
    customer-location.ts  endereços do cliente, só no browser dele
    delivery.ts           tempo de entrega, do jeito que o cliente lê
    freshness.ts          há quanto tempo ninguém mexe no cardápio
    image-resize.ts       encolhe a foto no browser, antes de subir
    opening.ts            quando a loja fechada volta a abrir
    slug.ts               normalização, gêmea da do banco
    money.ts              centavos ↔ texto
    order-message.ts      texto do pedido e link do wa.me
    menu-import.ts        lê o cardápio colado como texto
    promotions.ts         preço com desconto e janela de vigência
    proximity.ts          distância estimada pelo CEP
    recent-orders.ts      último pedido por loja, só no browser dele
    qr.ts                 QR code da loja, em SVG
    storefront.ts         tipos das views públicas
    subscription.ts       rótulos e aviso de vencimento
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
aparelho do cliente, então o segundo pedido custa um toque.

**Vários endereços, não um.** Pedir de casa é o caso que se imagina; pedir do
trabalho, da casa de um amigo ou para entregar na casa da mãe é o resto da
semana. Com um slot só, cada um desses obrigava a redigitar o CEP.

E — isto é o que decide o desenho — **o número e o complemento moram dentro de
cada endereço**, não ao lado deles. Um slot de contato compartilhado faria a
troca de endereço mandar a rua nova com o número do endereço anterior: o pedido
sai, a loja entrega, e ninguém descobre até bater na porta errada. Trocar de
endereço troca o pacote inteiro (`src/lib/customer-location.ts`).

O apelido ("Casa", "Trabalho") só é pedido a partir do **segundo** endereço. No
primeiro ele não distingue nada, e batizar coisas é a última vontade de quem
acabou de chegar e quer ver as lojas. Em cidade de CEP único ele é o que separa
casa de trabalho, porque o CEP é o mesmo nos dois — por isso o mesmo CEP com
apelidos diferentes conta como dois endereços, de propósito.

**Pagamento não entra na mensagem.** Quem cobra é a loja, e ela pergunta do
jeito dela. O Petire não vê dinheiro nenhum e não deveria dar a entender que
vê.

Tudo isso fica **só no browser do cliente** (`src/lib/customer-location.ts`).
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

## A busca perdoa acento, hífen e caixa

Comparar o texto digitado com o texto cadastrado quebra no caso mais comum que
existe: "coca cola" não acha "Coca-Cola", "acai" não acha "Açaí", "x salada" não
acha "X-Salada". E o produto aposta em achar a loja **pelo que ela vende** —
quem procura já não sabe o nome da lanchonete que faz coxinha.

A normalização já existia, para agrupar bairro e cidade: `public.slugify()`.
`products.name_slug` e `stores.name_slug` são colunas geradas por ela, e a busca
compara slug com slug. Pontuação virar hífen é o que faz "coca cola",
"Coca-Cola" e "COCA COLA" caírem todas em `coca-cola`.

Ela também é a defesa contra injeção de filtro que antes era um
`sanitizeSearch()` escrito a mão: o que sobra é `[a-z0-9-]`, então não há como
um `%`, um `_` ou uma vírgula digitados virarem curinga do LIKE ou separador do
PostgREST.

Sem índice, de propósito. `like '%x%'` não usa índice comum, e um GIN de
trigrama custa uma extensão e manutenção de escrita para varrer as poucas
centenas de linhas que um bairro tem.

## O cardápio longo

`/loja/[slug]` empilhava todas as categorias em sequência. Isso funciona para a
lanchonete de trinta itens e não funciona para a distribuidora, que tem centenas
de rótulos quase iguais — e distribuidora é metade do público que o Petire foi
buscar.

`MenuBrowser` dá duas saídas, porque são duas perguntas diferentes: quem sabe o
que quer busca, quem está decidindo passeia pelo índice de categorias. A barra
de categorias é fixa e marca onde a leitura está, via `IntersectionObserver`.

A filtragem é **no browser**. O cardápio inteiro já veio no HTML — é ele que o
Google indexa e é dele que a página vive. Ir ao servidor a cada tecla jogaria
isso fora e ainda seria mais lento.

## Loja fechada

O botão de enviar continuava verde e ativo fora do horário. O cliente pedia de
madrugada, ninguém respondia, e a culpa ficava dividida entre a loja e o site.

No carrinho, `resolveCart()` devolve `opensLabel` — "abre amanhã às 09:00" — e o
envio vira ação secundária. A conta está em `src/lib/opening.ts`, no fuso de
Brasília, o mesmo que `store_is_open()` usa: sem fixá-lo, o relógio do servidor
da Vercel decidiria quando a lanchonete abre.

`is_open_manual` entrou na `stores_public` para separar **fechada pelo horário**
de **fechada na mão**. Só a primeira tem hora a prometer; anunciar uma abertura
para a loja que o dono fechou seria inventar uma promessa por ele.

## O caminho de volta

Sem cadastro, o Petire some da vida do cliente no instante em que ele sai para o
WhatsApp — e a recompra é o que faz o número do lojista crescer do primeiro mês
para o segundo, que é quando ele decide renovar. Três coisas cobrem isso, todas
sem cadastro:

- **O link no rodapé da mensagem.** Fica na conversa dele com a loja, que é onde
  ele procura quando quer pedir de novo. É a última linha de propósito: num
  pedido que ainda estoura o limite do `wa.me`, o corte cai nele e nunca no
  endereço.
- **"Peça novamente" na home**, com **Repetir** para remontar o último pedido da
  loja num toque (`src/lib/recent-orders.ts`). Guarda só a identidade dos itens,
  como o carrinho: preço e disponibilidade são relidos do banco.
- **O convite a instalar**, só para quem **já pediu pelo menos uma vez**.
  Convidar quem acabou de chegar é pedir compromisso antes de entregar valor.
  Só Chromium dispara `beforeinstallprompt`; no iOS o convite não aparece, em
  vez de virar um tutorial que ninguém segue.

## O que o painel mostra, e o que ele promete

Estes números são a única prova de valor que existe, porque o pedido fecha fora
do sistema. Por isso o rótulo diz exatamente o que foi medido: "Pedidos abertos
no WhatsApp", não "pedidos enviados" — o evento é gravado quando o cliente sai
para o WhatsApp, e ninguém aqui vê se ele apertou enviar. A visita conta uma vez
por sessão, senão o próprio lojista dando F5 infla o número que ele usa para
decidir se renova.

A variação contra os 30 dias anteriores sai de `store_metrics(target, 60)` menos
os 30 recentes — a janela continua contada pelo relógio do banco, sem função
nova. Sem base de comparação nada é mostrado: uma seta verde saindo do zero
prometeria um crescimento que é só a estreia.

`store_top_products()` responde a única pergunta em que o lojista pode agir
sozinho: qual item puxa o pedido. `cart_add` já gravava o produto desde o
começo; o dado estava lá e ninguém mostrava.

## Demanda que o catálogo não atendeu

Busca sem resultado e CEP de cidade sem loja eram becos sem saída silenciosos —
e são o dado que diz onde abrir o próximo bairro. Vão para `demand_signals`,
**tabela separada de `events` de propósito**: `events` é a prova de valor de uma
loja, com `store_id` NOT NULL e índice por loja, e misturar contaminaria a
métrica que vira dinheiro. Só slug de lugar e termo procurado; o CEP continua
sem sair do aparelho do cliente.

No mesmo momento, `store_suggestions` pergunta o que o sinal não sabe responder:
*qual* loja faltou. Quem acabou de não encontrar nada sabe o nome e costuma
saber o Instagram — e a abordagem deixa de ser fria. O que se guarda é o contato
**da loja**, público por natureza; nada identifica quem indicou.

As duas tabelas são escritas só pelo servidor e lidas só pelo admin, que já usa
`service_role`. Escrita aberta viraria fábrica de demanda falsa para um bairro;
leitura aberta entregaria a fila de prospecção do Petire a qualquer um.

## A mensalidade

A cobrança é PIX conferido a mão. O que doía não era o valor: era o vencimento
anterior ser sobrescrito pelo seguinte, sem sobrar rastro de quando alguém
pagou.

`subscription_payments` é esse registro, e `registerPayment()` grava o pagamento
**e** move `stores.subscription_until` na mesma operação — fazer só o primeiro
tira do ar uma loja que pagou, e isso é o tipo de erro que o lojista descobre
pelo cliente. O gerente lê o próprio histórico (uma conversa a menos por
WhatsApp) e não escreve nada: assinatura nunca foi editável por ele.

`subscriptionNotice()` avisa antes. Quem descobre que venceu porque a loja sumiu
do catálogo já perdeu os pedidos do dia.

## Como uma loja entra

Cadastrar loja era trabalho do admin: pedir os dados por WhatsApp, digitar tudo,
devolver a senha. Funciona nas dez primeiras e vira o gargalo do go-to-market
por volta da trigésima — e é trabalho do fundador, não do produto.

`/cadastrar` é público e indexável: "colocar meu cardápio online" é coisa que
lojista procura no Google, e busca é o canal gratuito do Petire dos dois lados
do balcão. O que muda é **quem digita**, não quem aprova.

Duas coisas continuam do outro lado da aprovação, de propósito:

- **a conta de acesso.** Formulário aberto criando usuário de auth é convite a
  robô, e a senha inicial precisa chegar a uma pessoa de verdade;
- **a loja no ar.** Ela nasce fora do ar de qualquer jeito, e quem confere o
  cardápio é o admin.

Por isso `store_applications` é uma tabela à parte e não uma loja com mais um
status: uma linha ali não é uma loja, é um pedido para virar uma. Aprovar chama
`provisionStore()` — a mesma sequência do cadastro manual, extraída justamente
para não existirem duas cópias dela.

**A senha aparece uma vez só, e isso restringe o que a aprovação pode
revalidar.** `revalidatePath` limpa o cache de rota do cliente e faz a página
atual buscar de novo; na fila, isso remonta a lista sem o pedido aprovado e
desmonta o card que está mostrando a senha. Por isso `provisionStore()` não
revalida nada — e não precisa: a loja nasce fora do ar, então nenhuma página
pública muda.

## Cardápio que envelhece

Cardápio desatualizado é o risco número dois do próprio MVP, e a mitigação era
"esgotado em um toque" — que depende de o lojista lembrar. Nada envelhecia
sozinho: uma loja abandonada seguia no ar com preço de seis meses atrás, e quem
descobria era o cliente, no meio do pedido.

`src/lib/freshness.ts` mede a última edição pelo `max(products.updated_at)`, que
já existia por causa do trigger. Os dois lados usam a mesma régua: o admin vê
para saber com quem falar, o lojista vê para agir antes de alguém precisar falar
com ele.

## Degraus de plano

O plano abre **recurso**, nunca desconta comissão — comissão zero é a razão de a
loja estar aqui, e cobrar mais de quem vende mais seria comissão com outro nome.
A **loja fundadora** entra com o teto de itens do Plus sem estar no Plus
(`stores.is_founder`), porque esse teto é defensivo: ele existe para o cardápio
da distribuidora caber, e bater nele no primeiro dia é o que estraga o
onboarding. Os degraus que são oferta continuam sendo do plano. A vaga é
contada pelo banco — `enforce_founder_slots()` recusa a décima primeira do
bairro, para a escassez que a venda promete ser verdade.

Hoje o Plus abre quatro: o teto de itens do cardápio (`store_item_limit()`), a
promoção que se repete por dia da semana (`store_schedules_promotions()`), mais
de um acesso (`/gerente/equipe`) e o relatório do mês fechado
(`/gerente/relatorio`).

A repetição por dia da semana é **por dia, não por hora**, e isso é uma decisão
e não uma limitação preguiçosa: `/loja/[slug]` é estática com `revalidate` de
uma hora e resolve o preço no render, enquanto o carrinho relê do banco na hora.
Uma janela por dia vira na meia-noite, quando o desencontro entre os dois não
machuca ninguém. Uma janela por hora viraria às 18h, com o cardápio mostrando um
preço e o carrinho cobrando outro no pico. Ver `docs/precos.md`.

Nada disso toca a vitrine. O cliente não vê plano nenhum e a ordem da lista
continua sendo por distância — vender posição gastaria a confiança que traz o
cliente de volta, que é o ativo mais caro do produto.

`stores.plan` fica fora de `stores_public` e fora do `GRANT UPDATE` do gerente,
pelo mesmo motivo de `subscription_status`: quem muda o plano é quem cobra por
ele. O teto de logins vem de `store_manager_limit()`, no banco, para valer mesmo
se amanhã alguém escrever outra tela que crie gerente.

Os itens **Equipe** e **Relatório** aparecem no menu para todo mundo, inclusive
no plano que não os abre. Um item que some do menu não é uma oferta, é uma
dúvida; a página é que explica o degrau.

O relatório é por mês do calendário, e é por isso que `store_metrics_between()`
existe: nenhuma quantidade de dias corridos responde "agosto", porque agosto tem
31 e fevereiro tem 28. As janelas deslizantes do painel foram reescritas em cima
dela, para não haver duas contagens capazes de divergir.

## `events` não cresce para sempre

`events` é a única prova de valor que existe, porque o pedido fecha no WhatsApp,
fora do sistema. Por isso nunca foi apagado — e a tabela acumulava sem teto.

Apagar direto o que passa de 90 dias tinha um problema, e é ele que decide o
desenho: o **relatório mensal navega meses para trás**. Com poda seca, agosto
viraria zero em novembro, sem erro nenhum na tela — a mentira silenciosa de
sempre, e num recurso do plano pago.

Então `maintain_events()` **soma antes de apagar**, e a ordem importa:

| O que | Por quanto tempo |
|---|---|
| linha crua em `events` | 90 dias |
| mês somado em `store_month_metrics` | para sempre, ~1 linha por loja por mês |
| itens do mês em `store_month_top_products` | os 10 mais, por loja e mês |

O relatório lê por *read-through*: `store_month_report()` devolve a soma quando
ela existe e conta na hora quando não — o mês que acabou de fechar, antes de a
rotina da madrugada passar. Assim não há buraco de um dia.

Dois detalhes que estão no SQL e não são óbvios:

- O `on conflict do nothing` **não** é `do update`. Depois da poda, recalcular
  um mês antigo daria zero, e sobrescreveria a soma boa com esse zero.
- O nome do item é guardado junto do id. Item apagado em setembro não pode sumir
  do relatório de agosto.

A rotina roda pelo `pg_cron`, às 04:17. As janelas curtas — os 30 e 60 dias do
painel, a semana da confirmação — continuam lendo a linha crua, que sempre está
dentro da retenção.

## Quantos pedidos realmente chegaram

`whatsapp_click` mede intenção. O rótulo do painel já diz isso — mas isso resolve
a honestidade, não a pergunta: na renovação, o lojista responde "mas eu não
recebi 84".

Quem sabe é ele. Uma vez por semana o painel pergunta quantos chegaram, sobre a
semana que acabou de fechar (um mês depois ninguém lembra), e a razão entre as
duas contagens vira a taxa que faltava.

É a única coisa que o gerente escreve sobre as próprias métricas, e por isso o
denominador não passa pelo formulário: `opened` é preenchido por trigger a
partir dos eventos, e a coluna nem está no `GRANT INSERT` dele. Ele informa o
numerador; o sistema informa o resto. Também não há policy de update — uma
confirmação é registro do que aconteceu, não um número ajustável depois.

A pergunta não aparece quando não saiu pedido nenhum: aí não há o que calibrar,
e ela só serviria para lembrar o lojista de que a semana foi fraca.

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

**A foto é encolhida antes de subir** (`src/lib/image-resize.ts`). O lojista
fotografa o lanche com o celular e o arquivo tem 2 a 4 MB; o que vai para o
Storage é o que ele mandou, e fica lá para sempre. Sem encolher, um cardápio de
40 itens ocupa uns 100 MB, e quarenta lojas enchem um plano pago sozinhas.

O maior lado vira 1024px, em WebP a 80% — na medição, uma foto de 3024×4032 com
3,3 MB virou 232 KB, catorze vezes menor. O tamanho é generoso de propósito:
hoje a foto aparece a 80px na vitrine e 44px no painel, mas o original é o que
sobra, e não dá para pedir a ninguém que reenvie o que já mandou se um dia o
cardápio ganhar uma foto grande. O que o cliente baixa continua sendo a versão
que o `next/image` gera para a tela dele.

Detalhes que a conta esconde: o EXIF é respeitado na decodificação, senão foto
tirada de lado sobe deitada; sem WebP o fallback é JPEG com fundo branco, senão
PNG transparente vira foto de fundo preto; e o resultado só substitui o
original quando é **menor** que ele, porque imagem já pequena costuma crescer ao
ser reencodada.

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
