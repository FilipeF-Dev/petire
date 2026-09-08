# Marca e mensagem

O que o Petire diz, para quem, e com que palavras. Existe porque as frases do
produto estão espalhadas por metadados, telas e kit de divulgação, e sem um
lugar que mande nelas a variação vira contradição — e a contradição aparece
primeiro no resultado do Google, que é o canal de aquisição gratuito do
produto.

---

## O nome não se explica

*Petire*, do latim, pedir. É uma boa história de origem e um péssimo argumento
de venda: ninguém decide colocar o cardápio online por causa da etimologia.

Em material comercial o nome nunca vem acompanhado de explicação. Quem faz o
trabalho é a linha da marca, e o nome vira conhecido pelo uso — pelo cartaz no
balcão, pelo rodapé da mensagem do pedido, pelo endereço que o cliente digita.

Por isso, também: **o endereço aparece sempre que o nome aparece** em peça
física. Nome de marca que ninguém sabe escrever e não vem com o endereço do
lado é nome que não se procura depois.

## A linha da marca

> **Peça direto da loja.**

Uma linha, para os dois lados do balcão. Para o cliente é o que ele faz; para o
lojista é o que acontece com o cliente dele. "Direto" é a palavra que carrega
tudo o que o Petire é — sem intermediário, sem taxa de serviço, sem cadastro,
sem alguém no meio decidindo a ordem.

Ela não muda. O que muda é a frase seguinte, que depende de quem está lendo.

## As três mensagens

**Para o cliente.**
> Peça direto da loja do seu bairro. Sem taxa de serviço, sem cadastro, sem app.

O que ele ganha, na ordem em que ele se importa: preço, ausência de burocracia,
nada para instalar.

**Para o lojista.**
> Seu cardápio online, sem comissão por pedido. O pedido chega pronto no seu
> WhatsApp.

O que ele ganha, na ordem em que ele se importa: a comissão que ele não paga, e
o fato de não precisar mudar como trabalha.

**A que o lojista repete para o cliente dele.** Esta é a mais importante das
três, e a mais esquecida: é ela que roda no status do WhatsApp, na bio do
Instagram e na boca do atendente.
> Nosso cardápio está no Petire. Você monta o pedido pelo celular e ele chega
> aqui no nosso WhatsApp, pronto. Sem app e sem cadastro.

Ela tem de caber num status e ser dizível em voz alta atrás do balcão. Toda
frase nova do kit de divulgação passa por esses dois testes.

## A regra de honestidade: "sem taxa de serviço", nunca "sem taxa"

O Petire não cobra taxa de serviço do cliente. **A loja pode cobrar entrega** —
o produto inclusive tem `formatDeliveryFee()`, que escreve "a combinar" quando
o lojista não informou.

Então "sem taxa", seco, é uma promessa que o carrinho desmente três telas
adiante. É o tipo de detalhe que ninguém reclama e todo mundo desconta da
confiança, e confiança é o ativo que traz o cliente de volta — que é o que faz
o número do lojista crescer do primeiro mês para o segundo.

A frase completa é sempre **"sem taxa de serviço"**. Vale em título, descrição,
cartaz e conversa.

## O que nunca se promete

Três promessas que o produto não pode cumprir, e que aparecem sozinhas quando
alguém está tentando fechar uma venda difícil:

- **Movimento.** O Petire não traz cliente que a loja não tinha — não ainda.
  Quem tem clientela é a loja; o Petire encurta o caminho até ela. Prometer
  pedido é garantir uma renovação perdida no dia 91.
- **Entrega.** O Petire não entrega nada e não tem entregador. Quem entrega é
  a loja, do jeito que ela já entrega.
- **Pagamento.** O dinheiro não passa por aqui. Por isso pagamento não entra na
  mensagem do pedido: quem cobra é a loja, e o Petire não deve dar a entender
  que vê o que ela recebe.

Dizer as três em voz alta na visita **ajuda** a venda. O lojista já ouviu
promessa demais de aplicativo, e a lista do que não se promete é o que faz o
resto soar verdadeiro.

## Cor e tipo

| | |
|---|---|
| Terracota | `#c2410c` no claro, `#fb923c` no escuro |
| Tipografia | Geist, e o peso `semibold` no nome |
| Marca gráfica | o "P" geométrico de `scripts/make-icons.mjs` |

O terracota é quente sem ser o vermelho de aplicativo de delivery, que é
exatamente a distância que interessa: o Petire quer parecer o cardápio da loja,
não mais um app.

No escuro ele clareia para `#fb923c` porque o terracota fica ilegível sobre
preto. Essa troca é da marca, não do tema — a cor tem duas versões, e as duas
são a marca.

**Não vale investir em logo agora.** Antes de dez lojas, marca gráfica é gasto
sem retorno: o que faz o nome ser reconhecido é o cartaz no balcão de dez lojas
do mesmo bairro, não o desenho do "P". O wordmark — o nome em Geist semibold —
é suficiente e já está em uso.

---

## Onde cada frase vive

| Superfície | Arquivo |
|---|---|
| Título e descrição do site | `src/app/layout.tsx` |
| Manifesto do PWA | `src/app/manifest.ts` |
| Home | `src/app/(site)/page.tsx` |
| Rodapé | `src/app/(site)/layout.tsx` |
| Lista e página da loja | `src/app/(site)/lojas/page.tsx`, `loja/[slug]/page.tsx` |
| Página do lojista | `src/app/(site)/cadastrar/page.tsx` |
| Kit de divulgação | `src/app/gerente/divulgar/page.tsx` |

Mexeu numa, confira as outras. São sete lugares e uma marca.
