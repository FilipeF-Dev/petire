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
 * As três regras que custam caro quando faltam estão escritas nele:
 * preço em reais (centavos aqui multiplicam tudo por cem), zero para o item
 * cujo preço mora numa opção obrigatória, e `min: 1` para o que o cliente é
 * obrigado a escolher.
 */
export const PROMPT_DA_IA = `Transcreva este cardápio para JSON, no formato abaixo.

Regras:
- "preco" e "mais" vão em REAIS, com centavos depois do ponto: 24.90, não 2490.
- Item cujo preço depende de uma escolha (tamanho, sabor, tipo) vai com
  "preco": 0 e o valor real dentro das opções do grupo obrigatório.
- "min": 1 é grupo obrigatório; "min": 0 é opcional.
- "max" é quantas opções o cliente pode marcar.
- Não invente item, preço nem opção. O que estiver ilegível, deixe de fora.
- Responda só o JSON, sem comentário nem cerca de código.

{
  "secoes": [
    {
      "nome": "Lanches",
      "itens": [
        {
          "nome": "X-Salada",
          "preco": 24.90,
          "descricao": "Pão brioche, hambúrguer 180g, queijo, alface e tomate.",
          "grupos": [
            {
              "nome": "Ponto da carne",
              "min": 1,
              "max": 1,
              "opcoes": [
                { "nome": "Mal passado" },
                { "nome": "Ao ponto" },
                { "nome": "Bem passado" }
              ]
            },
            {
              "nome": "Adicionais",
              "min": 0,
              "max": 4,
              "opcoes": [
                { "nome": "Bacon", "mais": 5.00 },
                { "nome": "Ovo", "mais": 3.00 }
              ]
            }
          ]
        }
      ]
    },
    {
      "nome": "Bebidas",
      "itens": [
        {
          "nome": "Fanta",
          "preco": 0,
          "grupos": [
            {
              "nome": "Sabor",
              "min": 1,
              "max": 1,
              "opcoes": [
                { "nome": "Guaraná", "mais": 8.00 },
                { "nome": "Laranja", "mais": 8.00 },
                { "nome": "Uva", "mais": 8.00 }
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
