# Onboarding de uma loja

Como colocar uma loja real no ar, do primeiro contato à primeira cobrança.

O alvo da fase 5 é **10 lojas ativas em um bairro** — não 10 lojas espalhadas
pela cidade. Um cliente que abre o Petire e encontra duas lanchonetes não
volta; um que encontra dez, volta. Por isso o bairro fecha antes de o próximo
começar.

---

## 1. Antes de cadastrar

Peça ao lojista, de uma vez só, pelo WhatsApp:

| O quê | Por quê |
|---|---|
| Nome da loja, como está na fachada | Vira o título da página e o resultado da busca |
| CEP e número | Preenche endereço, bairro e cidade sozinho, e é o que ordena a lista |
| WhatsApp que recebe pedido | É para onde o pedido vai. Se for outro número, o pedido se perde |
| Tipo (lanches, pizza, padaria…) | É por onde o cliente filtra |
| **O cardápio em texto** | Bloco de notas, PDF, foto do cardápio, a mensagem que ele já manda no WhatsApp — qualquer coisa serve |
| E-mail do dono | Vira o login do painel |

O cardápio é o que trava o onboarding. Se ele vier em texto, dá para colar
inteiro no painel em um minuto (`/gerente/cardapio` → **Colar cardápio**). Se
vier em foto, alguém vai ter de digitar — combine quem antes de começar.

## 2. Cadastrar

`/admin` → **Nova loja**. O formulário cria a loja e a conta do gerente juntas,
e mostra a senha **uma vez**. Copie antes de sair da tela; se perder, gere
outra em `/admin/loja/[id]`.

A loja nasce **fora do ar** de propósito. Loja no ar sem cardápio é pior do que
loja nenhuma: o cliente entra, não encontra nada e não volta.

Entregue no WhatsApp do lojista: o endereço `/entrar`, o e-mail e a senha.

## 3. O que o lojista faz

O painel abre com **Primeiros passos**, que é a lista do que falta. Ele mesmo
resolve, na ordem:

1. Colar o cardápio
2. Cadastrar os horários
3. Marcar o tipo de culinária
4. Colocar a logo

O último passo — "loja no ar" — é seu, não dele. Ele não consegue se publicar,
e a lista diz isso.

## 4. Antes de colocar no ar

Confira você mesmo, em `/loja/<apelido>`:

- [ ] O cardápio tem itens, com preço certo
- [ ] Os horários batem com a realidade da loja
- [ ] O botão "Fazer pedido" abre o WhatsApp **certo** — mande um pedido de
      teste e confirme com o lojista que chegou

O pedido de teste não é formalidade. O número errado é o defeito mais caro do
Petire: o cliente pede, ninguém responde, e a culpa fica com a loja e com o
site ao mesmo tempo.

Depois disso, `/admin` → **Colocar no ar**.

## 5. Divulgação

Uma loja recém-publicada não recebe pedido sozinha — o catálogo ainda não tem
movimento. Mostre o `/gerente/divulgar` para o lojista no mesmo dia:

- o link, para a bio do Instagram e o status do WhatsApp;
- a mensagem pronta, para a lista de transmissão dele;
- o cartaz com QR, para imprimir e colar no balcão.

Quem já tem cliente é a loja. O Petire só encurta o caminho entre eles.

## 6. Cobrança

As 10 primeiras lojas do bairro entram com **90 dias grátis** — é o que paga o
risco de entrar num catálogo vazio. No cadastro, o campo de teste já aceita os
dias; depois disso, `/admin` → assinatura.

| Situação | Status | O que acontece |
|---|---|---|
| Período grátis | `trial` | Aparece normal |
| Mensalidade em dia | `active` | Aparece normal |
| Atrasou | `past_due` | Continua aparecendo — carência |
| Desistiu ou não pagou | `suspended` | Some do catálogo na hora |

Cobrança é manual (PIX) no v1. Marque o novo vencimento no painel assim que o
pagamento cair.

## 7. Renovação

O argumento não é o site: é o número. O painel do lojista mostra pedidos
enviados e visitas dos últimos 30 dias, e é isso que se leva para a conversa —
*"chegaram 84 pedidos por aqui este mês"*.

Como o pedido fecha no WhatsApp, fora do sistema, esses números são a única
prova de valor que existe. Se eles estiverem baixos, o problema é divulgação
(volte ao passo 5), não preço.
