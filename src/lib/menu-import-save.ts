import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParsedMenu } from "./menu-import";
import type { Database } from "./supabase/database.types";

/**
 * Grava um cardápio lido, seja ele de texto ou estruturado.
 *
 * Mora fora da Server Action porque agora tem dois chamadores: o lojista
 * colando o cardápio dele, e o suporte do Petire colando o de outra loja pela
 * tela do admin. Duas cópias desta função é como as duas telas passam a criar
 * cardápio de jeitos diferentes — e a segunda a ganhar uma correção meses
 * depois da primeira.
 *
 * **Só adiciona.** Importar não apaga nada do que já existe: quem colou duas
 * vezes conserta removendo os repetidos, e isso é muito melhor do que
 * descobrir que a importação levou junto o cardápio inteiro da loja.
 */

type Client = SupabaseClient<Database>;

export type ResultadoDaImportacao = {
  /** Nulo quando deu certo. */
  erro: string | null;
  itens: number;
  grupos: number;
};

/**
 * Confere se o que o banco devolveu está na ordem em que foi mandado.
 *
 * O PostgREST devolve as linhas inseridas na ordem do pedido, e é disso que
 * depende a ligação entre o item e os grupos dele — os ids só existem depois
 * da escrita. Confiar nisso calado seria arriscar o pior tipo de erro: o grupo
 * "Ponto da carne" pendurado na Coca-Cola, sem nenhum aviso.
 *
 * Conferir nome a nome transforma essa suposição em algo que falha alto.
 */
function mesmaOrdem(
  devolvidas: { name: string }[],
  mandadas: { name: string }[],
): boolean {
  if (devolvidas.length !== mandadas.length) return false;
  return devolvidas.every((linha, i) => linha.name === mandadas[i].name);
}

export async function salvarCardapio(
  supabase: Client,
  storeId: string,
  menu: ParsedMenu,
): Promise<ResultadoDaImportacao> {
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("store_id", storeId),
    supabase
      .from("products")
      .select("category_id, sort_order")
      .eq("store_id", storeId),
  ]);

  const existing = categoriesResult.data ?? [];
  const products = productsResult.data ?? [];

  // A categoria é única por (store_id, name), e "LANCHES" e "Lanches" são a
  // mesma seção para quem lê o cardápio. Casar sem diferenciar maiúscula evita
  // tanto o erro 23505 quanto a seção duplicada.
  const byName = new Map(
    existing.map((category) => [category.name.toLowerCase(), category.id]),
  );

  let nextCategoryOrder = existing.length;

  for (const section of menu.sections) {
    if (!section.category) continue;
    if (byName.has(section.category.toLowerCase())) continue;

    const { data, error } = await supabase
      .from("menu_categories")
      .insert({
        store_id: storeId,
        name: section.category,
        sort_order: nextCategoryOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        erro: `Não foi possível criar a categoria "${section.category}".`,
        itens: 0,
        grupos: 0,
      };
    }

    byName.set(section.category.toLowerCase(), data.id);
    nextCategoryOrder += 1;
  }

  // Cada categoria continua de onde parou, para o item novo entrar depois do
  // que já estava lá em vez de brigar por posição com ele.
  const nextOrder = new Map<string | null, number>();
  for (const product of products) {
    const key = product.category_id;
    nextOrder.set(
      key,
      Math.max(nextOrder.get(key) ?? 0, product.sort_order + 1),
    );
  }

  // A lista achatada, na ordem exata em que vai para o banco — é ela que
  // depois casa cada item com os grupos dele.
  const itens = menu.sections.flatMap((section) => {
    const categoryId = section.category
      ? (byName.get(section.category.toLowerCase()) ?? null)
      : null;

    return section.items.map((item) => {
      const order = nextOrder.get(categoryId) ?? 0;
      nextOrder.set(categoryId, order + 1);

      return {
        lido: item,
        linha: {
          store_id: storeId,
          category_id: categoryId,
          name: item.name,
          description: item.description ?? null,
          price_cents: item.priceCents,
          sort_order: order,
        },
      };
    });
  });

  const { data: criados, error } = await supabase
    .from("products")
    .insert(itens.map((item) => item.linha))
    .select("id, name");

  if (error || !criados) {
    return {
      // PT422 = o cardápio colado passa do teto do plano. É o caso mais
      // provável de estourar, porque aqui entram dezenas de itens de uma vez —
      // e a mensagem do banco já diz qual é o limite.
      erro:
        error?.code === "PT422"
          ? error.message
          : "Não foi possível gravar os itens.",
      itens: 0,
      grupos: 0,
    };
  }

  /*
    Os grupos vêm de dois lugares, e a diferença é o ponto da coisa.

    Os **reusados** são declarados uma vez no topo do cardápio e citados por
    vários itens: "Adicionais" nos doze hambúrgueres da casa. Eles viram **uma**
    linha em option_groups, ligada a doze produtos — que é para isso que a
    tabela do meio existe. Repetir o grupo dentro de cada item criaria doze
    grupos iguais, e o lojista mudaria o preço do bacon num deles e continuaria
    errado nos outros onze.

    Os **próprios** são do item e só dele: o "Sabor" da Fanta não é o "Sabor" do
    suco, ainda que os dois se chamem Sabor.
  */
  const apelidos = Object.keys(menu.shared ?? {});

  const proprios = itens.flatMap((item, itemIndex) =>
    (item.lido.groups ?? []).map((lido, posicao) => ({
      itemIndex,
      posicao,
      lido,
    })),
  );

  if (apelidos.length === 0 && proprios.length === 0) {
    return { erro: null, itens: criados.length, grupos: 0 };
  }

  if (
    !mesmaOrdem(
      criados,
      itens.map((item) => item.linha),
    )
  ) {
    return {
      erro:
        "Os itens entraram, mas não consegui ligar os grupos a eles com segurança. Adicione as opções pelo cardápio.",
      itens: criados.length,
      grupos: 0,
    };
  }

  // Reusados primeiro, próprios depois: é a ordem que o mapeamento de ids
  // abaixo assume, e ela precisa valer nos dois lados.
  const paraCriar = [
    ...apelidos.map((apelido) => (menu.shared ?? {})[apelido]),
    ...proprios.map((grupo) => grupo.lido),
  ];

  const { data: gruposCriados, error: erroGrupos } = await supabase
    .from("option_groups")
    .insert(
      paraCriar.map((grupo) => ({
        store_id: storeId,
        name: grupo.name,
        min_select: grupo.min,
        max_select: grupo.max,
      })),
    )
    .select("id, name");

  if (erroGrupos || !gruposCriados || !mesmaOrdem(gruposCriados, paraCriar)) {
    return {
      erro: "Os itens entraram, mas os grupos de opção não.",
      itens: criados.length,
      grupos: 0,
    };
  }

  const idPorApelido = new Map(
    apelidos.map((apelido, i) => [apelido, gruposCriados[i].id]),
  );

  const opcoes = paraCriar.flatMap((grupo, i) =>
    grupo.options.map((opcao, ordem) => ({
      store_id: storeId,
      group_id: gruposCriados[i].id,
      name: opcao.name,
      price_delta_cents: opcao.plusCents,
      sort_order: ordem,
    })),
  );

  /*
    A ordem em que os grupos aparecem no item: os próprios e depois os
    reusados. Na prática é a ordem que o cliente espera — primeiro a escolha
    que o item obriga (o ponto da carne), depois os adicionais.
  */
  const ligacoes = itens.flatMap((item, itemIndex) => {
    const meus = proprios
      .map((grupo, i) => ({ grupo, i }))
      .filter(({ grupo }) => grupo.itemIndex === itemIndex)
      .map(({ grupo, i }) => ({
        store_id: storeId,
        product_id: criados[itemIndex].id,
        group_id: gruposCriados[apelidos.length + i].id,
        sort_order: grupo.posicao,
      }));

    const citados = (item.lido.uses ?? []).map((apelido, ordem) => ({
      store_id: storeId,
      product_id: criados[itemIndex].id,
      group_id: idPorApelido.get(apelido) as string,
      sort_order: meus.length + ordem,
    }));

    return [...meus, ...citados];
  });

  const [opcoesResult, ligacoesResult] = await Promise.all([
    supabase.from("options").insert(opcoes),
    supabase.from("product_option_groups").insert(ligacoes),
  ]);

  if (opcoesResult.error || ligacoesResult.error) {
    return {
      erro: "Os itens entraram, mas as opções não. Confira o cardápio.",
      itens: criados.length,
      grupos: 0,
    };
  }

  return {
    erro: null,
    itens: criados.length,
    grupos: gruposCriados.length,
  };
}
