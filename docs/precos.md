# Preço e planos

Decisão de preço do Petire, e o porquê de cada número. Os valores vivem em
`src/lib/pricing.ts` — este documento existe para que ninguém tenha de
adivinhar a razão deles depois.

---

## A decisão

| | Mensalidade | O que abre |
|---|---|---|
| **Básico** | R$ 49 | Cardápio no ar até 100 itens, painel, promoções, métricas, kit de divulgação |
| **Plus** | R$ 79 | Tudo do Básico + cardápio até 1000 itens, mais de um login (`/gerente/equipe`) e o relatório do mês fechado (`/gerente/relatorio`) |
| **Fundador** | R$ 29, travada | Básico, para as 10 primeiras lojas de cada bairro |

As lojas fundadoras entram com **90 dias grátis**, contados de quando a loja
**entra no ar** — não do cadastro.

Nenhum plano toca comissão. Comissão zero não é um degrau: é a razão de a loja
estar aqui.

---

## Por que R$ 30 não sobrevive

R$ 30 veio do `CoreV1` como um chute defensivo, e o próprio `MVP.md` já
registrava o problema: *"R$30/mês não paga suporte humano"*. Três coisas o
derrubam:

**A âncora está errada.** O lojista não compara o Petire com outro software —
ele compara com a comissão que já paga. Uma loja que faz R$ 5.000/mês num
aplicativo a 23% entrega R$ 1.150 por mês. Ao lado disso, a diferença entre
R$ 30 e R$ 49 não existe. Foi por preço nenhum que ele disse não.

**Barato demais lê como provisório.** Cardápio online é a vitrine da loja. Por
R$ 30 ele parece o projeto de alguém que pode sumir em três meses — e sumir é
exatamente o medo de quem vai colocar o cardápio ali.

**Preço sobe mal.** Subir de R$ 30 para R$ 49 na centésima loja é uma conversa
com cem lojistas. Começar em R$ 49 é uma conversa com nenhum.

## Por que R$ 49 e não R$ 99

Porque o valor entregue ainda é um cardápio bem-feito e um pedido que chega
pronto no WhatsApp — não uma operação de delivery. R$ 99 exigiria prometer o
que o produto hoje não entrega, e a primeira renovação cobraria a promessa.

R$ 49 é o teto do que se pede sem precisar de prova, e piso do que paga a
operação. Ele sobe quando a prova existir — ver *Quando reavaliar*.

## O preço de fundador é a arma comercial

O que mata a venda no balcão não é o preço: é *"deixa eu pensar"*. Uma loja
que pensa não volta, porque no dia seguinte o problema dela é o fornecedor que
não entregou.

O preço de fundador dá um motivo real para decidir hoje, e ele é honesto
justamente porque a escassez não foi inventada para vender: o roteiro do
produto é **10 lojas por bairro** (`docs/onboarding.md`), e a vaga acaba de
verdade. Nada aqui pede fidelidade, multa ou contrato — a única coisa que a
loja perde ao adiar é o preço travado.

Ele também paga o que de fato se está pedindo dela. As 10 primeiras entram num
catálogo sem movimento e trazem os próprios clientes; elas não estão comprando
audiência, estão construindo a audiência das lojas que vierem depois. R$ 29
vitalício é o preço disso, e por isso **não expira junto com o teste**.

## Os 90 dias contam de quando a loja entra no ar

Isso não é generosidade, é o que faz a primeira cobrança ter argumento.

O teste contado do cadastro é queimado pelo que trava o onboarding — o
cardápio que veio em foto, o horário que ninguém confirmou. A loja chega ao
dia 91 com três semanas de catálogo real e nenhum número, e a conversa de
renovação vira uma discussão sobre se o Petire funciona. Contado da
publicação, ela chega com 90 dias de métrica no painel, que é a única prova de
valor que existe quando o pedido fecha fora do sistema.

Quem aperta "Colocar no ar" é o admin, então a data existe e é confiável.

## O que sustenta o degrau do Plus

O Plus abre três coisas: mais de um login (`/gerente/equipe`), o relatório do
mês fechado (`/gerente/relatorio`) e o teto de itens do cardápio — 100 no
Básico, 1000 no Plus (`store_item_limit()`).

O teto é o único dos três que segmenta sozinho, e é isso que faz o degrau
existir: 100 itens cobrem qualquer lanchonete com folga, e nenhuma
distribuidora de bebidas cabe neles. Na prática, lanchonete é Básico e
distribuidora é Plus — o que é defensável, porque a distribuidora é também
quem mais usa o catálogo.

Regra que nenhum degrau futuro pode quebrar: **nada que mexa na ordem da
vitrine**. Vender posição gasta a confiança que traz o cliente de volta (ver
`README.md`, *Degraus de plano*).

### O risco comercial disso, e a trava

Metade do público que o Petire foi buscar é distribuidora. Um teto de 100
itens é, para ela, uma parede no primeiro dia — colando o cardápio, que é o
passo do onboarding que já trava. Se ela bater nessa parede durante os 90 dias
grátis, a conversa deixa de ser "veja quantos pedidos chegaram" e vira "por que
meu cardápio não coube".

Por isso, na fase de fundação de um bairro: **loja fundadora entra com o teto
do Plus, pagando o preço de fundador.** O teto vira cobrança só quando o
Básico for vendido a preço cheio, para quem chega depois.

Ainda faltam degraus para o Plus se sustentar fora do caso da distribuidora.
Candidatos, em ordem de dor:

1. **Promoção programada.** `promotions` já tem janela de vigência; falta
   deixar o lojista agendar sem estar na tela. "Toda sexta, chopp com 20%" é
   trabalho recorrente que hoje é feito na mão.
2. **Mais de um ponto sob o mesmo login.** A loja com duas unidades hoje
   precisa de dois cadastros e dois cardápios.
3. **Cartaz e artes com a marca da loja.** O kit de divulgação é o mesmo para
   todo mundo; personalizado, vira material que o lojista usaria de verdade.

## Quando reavaliar

Duas portas, e basta uma:

- **Na 50ª loja ativa.** É onde o suporte deixa de caber nas horas do fundador
  e o preço precisa pagar alguém.
- **Quando existir prova de aquisição.** Enquanto o cliente que chega à loja
  é o cliente que a própria loja trouxe, o Petire vende ferramenta. No dia em
  que o catálogo entregar cliente que a loja não tinha, ele vende demanda — e
  isso tem outro preço.

Quando subir, sobe para quem entra: as fundadoras seguem em R$ 29. Um preço
travado que destrava é pior do que nunca ter sido prometido.

## O que não muda

**Nenhum plano desconta comissão, em nenhum volume.** Cobrar mais de quem
vende mais é comissão com outro nome, e comissão é o motivo de o lojista
atender a primeira ligação.

**O Petire não vê o dinheiro do pedido.** Quem cobra é a loja. A mensalidade é
a única coisa que o Petire fatura, e ela não depende do que a loja vendeu.

**O cliente não vê plano nenhum.** A ordem da vitrine é por distância, e
continua sendo.

---

## O que isto exige do código

| Item | Estado |
|---|---|
| Valores num lugar só | `src/lib/pricing.ts` |
| A conta da comissão na página do lojista | `/cadastrar` |
| Contagem do teste a partir da publicação | **pendente** — hoje o campo de dias é preenchido a mão no cadastro |
| Marcar a loja como fundadora | **pendente** — hoje o preço travado só existe no acordo, não no cadastro |
| Teto do Plus para a loja fundadora | **pendente** — hoje `store_item_limit()` só olha `stores.plan` |
| Cobrança | manual, PIX (`/admin/loja/[id]`), como no v1 |
