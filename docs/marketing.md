# Canais

Onde o Petire gasta atenção e dinheiro, em que ordem, e o que não fazer. A
praça é Juiz de Fora e o primeiro bairro é decidido em
[bairro-de-estreia.md](bairro-de-estreia.md).

---

## O princípio que governa tudo

**Não se gasta em aquisição de cliente antes de o bairro ter dez lojas.**

Antes disso, cada real traz alguém para um catálogo em que a lanchonete dele
não está. E o Petire não tem cadastro — não há e-mail, push nem login para
chamar essa pessoa de volta depois. A primeira impressão é a única que existe,
e ela é irreversível de um jeito que quase nenhum produto sofre.

Isso inverte a ordem intuitiva: primeiro se enche o bairro de lojas, depois se
traz cliente. O que enche o bairro de lojas é visita presencial e tráfego pago
**do lado do lojista** — não anúncio para o consumidor.

## A ordem dos canais

| # | Canal | Quando | Custo |
|---|---|---|---|
| 1 | A audiência dos próprios lojistas | desde a primeira loja | zero |
| 2 | Cartaz no balcão e adesivo na sacola | desde a primeira loja | impressão |
| 3 | Busca orgânica (`/loja/[slug]`) | já roda sozinha | zero |
| 4 | Tráfego pago **para lojista** | desde já | baixo |
| 5 | Micro-influenciador **do bairro** | com 10 lojas no ar | baixo |
| 6 | Tráfego pago **para cliente** | com 10 lojas no ar | médio |

Os três primeiros já estão construídos. Vale dizer por que eles vêm antes de
qualquer verba: **quem tem clientela é a loja.** Dez lanchonetes com dois mil
seguidores locais cada uma são vinte mil pessoas do bairro certo, de graça, e
divulgadas por quem elas já conhecem. Nenhum anúncio compra isso mais barato — e
é exatamente por isso que o `/gerente/divulgar` existe com arte pronta.

---

## Micro-influenciadores

### O erro que parece óbvio e não é

Contratar o perfil de comida de Juiz de Fora com vinte mil seguidores. A
audiência dele está espalhada pela cidade inteira, e enquanto só Benfica tem
loja, a maior parte de quem clicar vai abrir um catálogo que não atende o bairro
dela.

Pior: gasta-se a verba **e** a primeira impressão de milhares de pessoas ao
mesmo tempo. É o pior negócio disponível.

### O que funciona

**O perfil do bairro, não o da cidade.** As páginas de bairro — "Benfica em
foco" e parecidas —, os grupos de moradores, o perfil de duas a oito mil
seguidas concentradas ali. Alcance menor, sobreposição quase total com o
catálogo.

**O conteúdo é sobre a loja, não sobre o Petire.** Ele pede de uma lanchonete
real do bairro, mostra a comida, e o Petire aparece só como o caminho: *"pedi
pelo cardápio deles aqui, ó"*. Marca desconhecida sendo anunciada como marca é
a coisa mais cara que existe para comprar; marca aparecendo dentro de uma
história sobre um X-Salada é de graça.

**O arranjo que fecha:** o Petire paga o pedido, a loja produz e entrega. Custa
o preço de um pedido, dá conteúdo ao influenciador, dá movimento e conteúdo à
loja — e a loja acabou de ganhar um motivo a mais para renovar. Um só custo,
três beneficiados.

### O que não fazer

- **Não pague por seguidor.** Pague por post em perfil cuja audiência mora onde
  há loja. Cinco mil seguidores do bairro valem mais que cinquenta mil da cidade.
- **Não peça para ele falar do Petire.** Peça para ele pedir comida.
- **Não faça antes das dez lojas.** Vale a mesma regra do princípio.

---

## Tráfego pago

### Comece pelo lado do lojista, não pelo do cliente

É onde está a assimetria. Buscas como *"cardápio online para lanchonete"*,
*"cardápio digital whatsapp"* ou *"alternativa ao iFood sem comissão"* têm
volume pequeno e intenção altíssima — quem digita isso está com o problema na
mão hoje. E a página de destino já foi construída para fechar sozinha: o preço,
a conta da comissão e as quatro objeções estão todos em `/cadastrar`.

Do outro lado, *"delivery juiz de fora"* é território de quem tem orçamento de
aplicativo. O custo por clique reflete isso, e uma disputa dessas não se ganha
com verba de fundador.

**A métrica não é clique nem visita: é candidatura em `store_applications`.**
Cinco cliques que viram uma loja valem mais que quinhentos que não viram
nenhuma, e é a fila de `/admin/pedidos` que responde isso.

Comece pequeno o bastante para o resultado ser legível — se em um mês não
entrou candidatura nenhuma, o canal não é esse, e a resposta é voltar para a
rua, não dobrar a verba.

### O lado do cliente, depois

Quando o bairro estiver cheio, o único canal cujo alvo corresponde ao escopo do
produto é o **Meta com raio pequeno** — dois ou três quilômetros em torno do
bairro. Facebook e Instagram sabem fazer isso bem, e é a única segmentação que
casa com um catálogo que só existe dentro de um bairro.

Duas regras para a criativa:

- **Anuncie um produto com preço, de uma loja real.** Não a marca Petire. O
  X-Bacon do Zé por R$ 24 é uma oferta; "o Petire chegou ao seu bairro" é uma
  pergunta que ninguém fez.
- **Leve para `/loja/[slug]`, não para a home.** A home pede o CEP porque não
  sabe onde a pessoa está. O anúncio sabe — mandar para a home é cobrar um
  passo que já foi respondido pela segmentação.

---

## O buraco que precisa ser tapado antes de gastar

**Hoje o Petire não sabe de onde veio um pedido.**

`events` grava `store_view`, `cart_add` e `whatsapp_click`, e é com isso que a
renovação é defendida. Mas nenhum desses registros carrega **origem**. Então,
depois de um mês gastando em anúncio e pagando influenciador, a pergunta *"os
quarenta pedidos vieram de onde?"* não tem resposta — nem para o Petire, nem
para o lojista.

Isso não impede começar pelo lado do lojista, que se mede pela fila de
candidaturas. Mas impede medir qualquer coisa do lado do cliente, que é
exatamente onde o dinheiro é maior.

**A proposta mínima, coerente com o produto:** um parâmetro na URL — algo como
`/loja/zé?de=cartaz` — gravado junto do `store_view`. Sem cookie, sem pixel de
terceiro, sem identificar ninguém: só de onde o link foi clicado. Isso permitiria
separar cartaz, adesivo, status do lojista, influenciador e anúncio, e daria ao
lojista a única resposta que ele realmente quer na renovação — *o que trouxe
esses pedidos*.

Fica registrado aqui como **decisão pendente de produto**, e não como algo já
combinado. Enquanto ela não existir, tráfego pago para o cliente é gasto no
escuro, e vale menos do que a mesma verba em impressão de cartaz.

---

## O calendário, em ordem

1. **Agora.** Levantamento de rua em Benfica (`/admin/prospeccao`), visitas, e
   um teste pequeno de busca paga para lojista.
2. **Enquanto as lojas entram.** Cartaz e adesivo em cada uma, no mesmo dia da
   publicação. É o passo 5 do `onboarding.md` e é o que mais muda o número da
   primeira renovação.
3. **Com dez lojas no ar.** Aí sim: perfil do bairro, um pedido pago para
   conteúdo, e o primeiro anúncio geolocalizado — com a atribuição resolvida
   antes, ou sabendo que se está gastando no escuro.
4. **Bairro cheio.** O próximo bairro sai de `demand_signals`, e não de palpite.
   A partir daqui o produto escolhe sozinho.
