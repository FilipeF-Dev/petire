/**
 * JSON para dentro de uma tag `<script>`, sem deixar ninguém sair dela.
 *
 * `JSON.stringify` escapa o que o **JSON** precisa — aspas, barra invertida,
 * quebra de linha — e nada do que o **HTML** precisa. O analisador de HTML não
 * lê JSON: ele procura a sequência `</script` e fecha o bloco ali, onde quer
 * que ela apareça. Então uma loja com a descrição
 *
 *     Lanches</script><script>...</script>
 *
 * fechava o bloco de dados estruturados e o resto virava script de verdade, na
 * origem do Petire, para todo cliente que abrisse a página dela. Testado antes
 * da correção: o script rodou.
 *
 * O que isso dava a quem escrevesse: o endereço e o carrinho guardados no
 * aparelho do cliente, e — pior — o poder de reescrever o link do WhatsApp,
 * mandando o pedido para outro número. O nome e a descrição da loja são
 * digitados no painel, então bastava um lojista mal-intencionado ou uma conta
 * de lojista invadida.
 *
 * A correção é a de sempre: escapar `<` como `\\u003c`. O JSON continua
 * exatamente o mesmo depois do `JSON.parse` — `"\\u003c"` **é** `<` — e o
 * analisador de HTML nunca mais vê a sequência que o faz fechar a tag.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
