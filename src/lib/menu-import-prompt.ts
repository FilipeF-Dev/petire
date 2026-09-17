/**
 * O pedido pronto para colar numa IA.
 *
 * Quem monta o cardápio estruturado é o suporte do Petire, a partir de uma
 * foto, de um PDF ou do print que o lojista mandou no WhatsApp. O trabalho de
 * transcrever isso é da IA — e ela só acerta se souber exatamente o formato.
 *
 * Mora ao lado do schema que ele descreve, em `menu-import.ts`, de propósito:
 * texto de instrução que envelhece longe do código que valida vira instrução
 * mentirosa, e o sintoma é a IA devolvendo um JSON que a tela recusa sem que
 * ninguém entenda por quê.
 *
 * As duas regras de **agrupamento** não são detalhe de formato: são a diferença
 * entre um cardápio usável e uma lista. Um cardápio de verdade transcrito linha
 * a linha deu 221 itens; com as regras, 85 — e nenhum sabor se perdeu, eles
 * viraram escolha dentro do item. Um cliente rolando 221 linhas no celular não
 * encontra o que quer, e um lojista com 221 itens estoura o teto do plano
 * Básico sem ter 221 produtos.
 *
 * E as três regras de campo que custam caro quando faltam: preço em reais
 * (centavos aqui multiplicam tudo por cem), zero para o item cujo preço mora
 * numa opção obrigatória, e `min: 1` para o que o cliente é obrigado a
 * escolher.
 */
export const PROMPT_DA_IA = `Transcreva este cardápio para JSON, no formato abaixo.

## Regras de valor

- "preco" e "mais" vão em REAIS, com centavos depois do ponto: 24.90, não 2490.
- "min": 1 é grupo obrigatório; "min": 0 é opcional.
- "max" é quantas opções o cliente pode marcar.
- Não invente item, preço nem opção. O que estiver ilegível, deixe de fora.
- Responda só o JSON, sem comentário nem cerca de código.

## Regra 1: variação do mesmo produto vira UM item

Quando vários itens são claramente o mesmo produto mudando só de tamanho,
sabor, tipo ou recheio, junte num item só:

- "preco": 0
- "descricao" com a prévia das opções ("Guaraná, laranja, uva ou limão.")
- um grupo obrigatório ("min": 1, "max": 1) com o preço de cada variação em
  "mais"

Exemplos do que juntar: Coca-Cola lata/600ml/1,5L → um item "Coca-Cola" com
grupo "Tamanho". Picolé de oito sabores → um item "Picolé" com grupo "Sabor".
Pastel com vinte recheios → um item "Pastel" com grupo "Recheio".

**Coca-Cola e Coca-Cola Zero continuam sendo dois itens.** São produtos
diferentes, cada um com o próprio grupo de tamanho. O mesmo vale para Fanta
Laranja e Fanta Uva se a loja as anuncia separadamente com preços próprios.

**Não junte pratos de composição diferente.** X-Bacon, X-Egg e X-Tudo são
lanches distintos, não tamanhos de um "X". Combos também ficam separados.
Juntá-los descaracteriza o cardápio.

## Regra 2: grupo repetido é declarado uma vez

Quando o mesmo grupo aparece em vários itens — "Adicionais" nos hambúrgueres,
"Ponto da carne" em todos os lanches de carne — declare-o UMA vez em "grupos",
no topo, e cite o apelido dele em "usa" nos itens.

Isso importa depois: assim o lojista muda o preço do bacon num lugar só e vale
em todos os lanches. Se cada item tiver o próprio grupo, ele muda num e fica
errado nos outros.

Grupo que é só de um item continua dentro dele, em "grupos". O "Sabor" da Fanta
não é o "Sabor" do suco, ainda que os dois se chamem Sabor.

## O formato

{
  "grupos": {
    "adicionais": {
      "nome": "Adicionais",
      "min": 0,
      "max": 4,
      "opcoes": [
        { "nome": "Bacon", "mais": 5.00 },
        { "nome": "Ovo", "mais": 3.00 },
        { "nome": "Cheddar", "mais": 4.00 }
      ]
    },
    "ponto": {
      "nome": "Ponto da carne",
      "min": 1,
      "max": 1,
      "opcoes": [
        { "nome": "Mal passado" },
        { "nome": "Ao ponto" },
        { "nome": "Bem passado" }
      ]
    }
  },
  "secoes": [
    {
      "nome": "Lanches",
      "itens": [
        {
          "nome": "X-Salada",
          "preco": 24.90,
          "descricao": "Pão brioche, hambúrguer 180g, queijo, alface e tomate.",
          "usa": ["ponto", "adicionais"]
        },
        {
          "nome": "X-Bacon",
          "preco": 28.90,
          "descricao": "Pão brioche, hambúrguer 180g, cheddar e bacon.",
          "usa": ["ponto", "adicionais"]
        }
      ]
    },
    {
      "nome": "Bebidas",
      "itens": [
        {
          "nome": "Coca-Cola",
          "preco": 0,
          "descricao": "Lata, 600ml ou 1,5L.",
          "grupos": [
            {
              "nome": "Tamanho",
              "min": 1,
              "max": 1,
              "opcoes": [
                { "nome": "Lata 350ml", "mais": 7.00 },
                { "nome": "600ml", "mais": 9.50 },
                { "nome": "1,5L", "mais": 14.00 }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Cardápio a transcrever:
`;
