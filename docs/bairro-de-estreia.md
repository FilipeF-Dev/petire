# O bairro de estreia

Onde abrir o Petire primeiro, e por quê. A praça é **Juiz de Fora, MG**.

O alvo é o da fase 5: **10 lojas ativas em um bairro** — não 10 lojas
espalhadas pela cidade. Um cliente que abre o Petire e encontra duas
lanchonetes não volta; um que encontra dez, volta. Esta escolha decide se as
dez primeiras vão ser difíceis ou impossíveis.

---

## Os seis testes

Um bairro precisa passar nos seis. Falhar em um só já custou meses em produtos
parecidos.

**1. O bairro se reconhece como bairro.** A home agrupa por bairro, e a lista
ordena por proximidade. Isso só significa alguma coisa onde o morador diz "aqui
no bairro" e sabe o que isso quer dizer. Onde a identidade é fraca, o
agrupamento vira gaveta administrativa e o cliente não se vê nela.

**2. O comércio está concentrado.** Dez lojas em duas ou três ruas é uma tarde
de trabalho. Dez lojas espalhadas por quatro quilômetros é uma semana, e é a
mesma semana toda vez que uma delas precisar de ajuda.

**3. A loja já vende pelo WhatsApp.** O Petire encurta o caminho entre a loja
e o cliente dela — ele não cria clientela. A loja que já tem um número que toca
o dia inteiro é a que ganha alguma coisa no primeiro dia. A que não tem vai
esperar um movimento que o catálogo ainda não pode entregar, e não renova.

**4. O aplicativo ali entrega mal, ou dói.** Duas situações servem, e por
motivos opostos: a loja que **está** no app e sente a comissão (a conta de
`/cadastrar` fecha sozinha para ela), e a loja que **não está** e vende só por
WhatsApp com cardápio em foto (para ela o Petire não é economia, é a primeira
vitrine). O bairro ruim é o terceiro caso: app forte, entrega boa, lojista
satisfeito.

**5. O cliente pede repetido.** O número do lojista precisa crescer do primeiro
mês para o segundo, que é quando ele decide renovar. Isso vem de recompra:
bairro residencial denso, gente que pede toda semana. Bairro de passagem gera
visita e não gera segundo pedido.

**6. Você consegue voltar lá.** O onboarding é presencial: a visita, o pedido
de teste, a conversa quando o cardápio desatualiza. Um bairro a quarenta
minutos de você não tem dez visitas — tem três.

---

## Aplicado a Juiz de Fora

> O que segue é raciocínio sobre a cidade, não levantamento. A ordem só vale
> depois do teste de rua descrito adiante — duas horas de calçada valem mais
> do que qualquer estimativa feita aqui.

### 1. Benfica — a recomendação

Benfica passa nos testes 1, 2, 4 e 5 com folga, e é o bairro onde a tese do
Petire aparece mais limpa.

Ele funciona como cidade dentro da cidade: tem centro comercial próprio,
identidade forte — quem mora lá "vai ao Centro", como quem sai da cidade — e
está longe o bastante do Centro para que a lanchonete de lá não entregue aqui.
A concorrência de uma loja de Benfica é outra loja de Benfica, que é exatamente
o recorte que a lista do Petire faz.

É também onde o comércio de dono único é a regra e não a exceção: lanchonete,
padaria, distribuidora de bebidas e gás, todos com um número de WhatsApp que já
toca. Ticket menor que o da Zona Sul — e é justamente por isso que a comissão
dói mais lá, porque ela é percentual e o custo da loja não é.

O risco é o teste 6: se você não circula por Benfica, dez visitas viram três.

### 2. Zona Leste — Bairu, Linhares, Progresso, Vila Ideal

Mesma lógica de Benfica, com mais densidade residencial e menos identidade de
bairro isolado. Boa segunda opção, e o lugar mais provável do segundo bairro
depois que o primeiro fechar — a proximidade entre eles faz o catálogo parecer
maior para quem mora na divisa.

Cuidado com o recorte: "Zona Leste" não é um bairro, e tratar quatro bairros
como um só é o erro que faz o cliente abrir a lista e não ver o dele. Escolha
**um**, feche os dez, siga para o vizinho.

### 3. São Pedro e Martelos — o entorno da UFJF

O público mais fácil de convencer do lado do cliente: república, pedido
frequente, celular na mão, e sensibilidade a preço que faz "sem taxa de
serviço" ser um argumento de verdade.

Duas ressalvas sérias. É o público mais nativo de aplicativo que existe — a
loja de lá provavelmente já está no iFood e satisfeita. E o movimento é
sazonal: férias e recesso esvaziam o bairro, e a primeira renovação pode cair
justamente num mês vazio, com um número que não representa nada.

### 4. Centro — não

O Centro reprova nos testes 1 e 5, e é a armadilha óbvia porque é onde há mais
loja. A lanchonete do Centro entrega na cidade inteira, então ela não é "a loja
do bairro" de ninguém; e quem está no Centro está de passagem, não pedindo em
casa toda semana. Dez lojas ali dão um catálogo grande e nenhuma recompra.

---

## O levantamento que decide, em duas horas

Antes de escolher, ande no bairro candidato e anote o que dá para ver da
calçada. Vale mais do que qualquer análise feita de longe.

A tela é **`/admin/prospeccao`**, e ela é feita para ser usada em pé, entre uma
porta e a seguinte: bairro e cidade continuam preenchidos da anotação anterior,
e só o nome e as três marcas voltam ao zero.

| Coluna | Como preencher |
|---|---|
| Nome da loja | O que está na fachada |
| Tem cardápio visível? | Impresso, adesivado, na vitrine |
| WhatsApp na fachada? | É o sinal do teste 3 |
| Está em aplicativo? | Busca no app, ali mesmo |

Ausente é **não**, e não "não sei": quem preenche está parado na frente da
loja. Se não há cardápio na vitrine, isso é a resposta.

O bairro está pronto quando você contar **quinze ou mais** lojas candidatas
numa área que dá para andar. Quinze, e não dez, porque nem toda visita fecha —
e um bairro em que você precisa converter 100% para bater a meta é um bairro
que não bate.

As colunas viram a **ordem da visita** e o **argumento de abertura**, e as duas
coisas são calculadas por `src/lib/prospects.ts`:

- **Em aplicativo** → a dor é comissão, e ela fecha sozinha numa conta. Ganha de
  qualquer outra, inclusive de não ter cardápio online — porque ele tem um, o do
  aplicativo.
- **Sem cardápio visível** → a dor é vitrine. Mostre a página de outra loja no
  celular.
- **Com cardápio e WhatsApp** → o ganho é o pedido chegar escrito, sem ida e
  volta.
- **Sem WhatsApp na fachada** → o encaixe é menor. Confirme como o cliente pede
  hoje antes de gastar a visita.

A lista da tela já vem nessa ordem. As primeiras visitas de um bairro são as que
decidem se o fundador continua, e por isso elas são as de conversa mais curta.

---

## Quando o bairro fechar

A partir da estreia, quem escolhe o próximo bairro não é mais este documento —
é o produto. `demand_signals` grava toda busca sem resultado e todo CEP de
cidade ou bairro sem loja, e `store_suggestions` guarda o nome que o cliente
digitou quando não achou. Os dois aparecem em `/admin`.

Ou seja: o segundo bairro é escolhido pela demanda que o primeiro revelou, e
não por palpite. Só o primeiro precisa ser decidido no escuro — e é este o
documento que faz isso.
