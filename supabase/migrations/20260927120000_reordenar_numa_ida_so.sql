-- =============================================================================
-- Petire — reordenar o cardápio numa ida só
--
-- Relatado por quem estava organizando o cardápio: em certo momento o item
-- parava de se mover, e recarregar a página não resolvia.
--
-- Medido: um clique custava **N+1 idas ao servidor**, onde N é o número de
-- itens da categoria. A ação lia a lista e depois mandava um UPDATE separado
-- para cada item, porque ela reescreve as posições inteiras de propósito — é o
-- que conserta sozinho um sort_order duplicado. Numa categoria de 40 itens,
-- 41 requisições. Com o banco em localhost, 226ms; em produção, onde cada ida
-- cruza a rede entre a função e o Supabase, um a três segundos por clique.
--
-- A lentidão era o sintoma visível. O defeito estava atrás dela: quem não vê
-- resposta clica de novo, e o segundo clique **lê a ordem antes de o primeiro
-- terminar de escrever**. Os dois calculam a mesma troca e um escreve por cima
-- do outro. Reproduzido: dois cliques em "para cima", o item andou uma posição.
-- Clicando rápido, ele fica parado — exatamente o que foi relatado.
--
-- Ler e escrever em chamadas separadas é o que abre essa janela, e nenhuma
-- quantidade de trava na tela fecha ela: dois aparelhos, ou duas abas, teriam o
-- mesmo problema. A decisão inteira desce para o banco, onde acontece em uma
-- instrução — atômica, sem janela, e numa ida só.
--
-- `security invoker` porque quem manda continua sendo o lojista: o RLS decide
-- quais linhas ele enxerga e quais ele pode escrever, igual a antes. A função
-- não ganha poder nenhum; ela só junta num lugar o que estava espalhado em
-- quarenta requisições.
--
-- O desempate por `id` no fim da ordenação não é detalhe. Sem ele, dois itens
-- com o mesmo `sort_order` e o mesmo `created_at` — o que um cardápio colado de
-- uma vez produz — ficam numa ordem que o Postgres pode devolver diferente a
-- cada consulta, porque um UPDATE reescreve a linha e muda a posição física
-- dela. A tela mostrava uma ordem e a ação via outra.
-- =============================================================================

create or replace function public.move_product(
  p_store uuid,
  p_category uuid,
  p_id uuid,
  p_direction text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ordenados uuid[];
  atual int;
  alvo int;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction;
  end if;

  -- `is not distinct from` no lugar de `=`: os itens sem categoria formam um
  -- grupo como qualquer outro, e `category_id = null` não encontraria nenhum.
  select array_agg(p.id order by p.sort_order, p.created_at, p.id)
    into ordenados
    from public.products p
   where p.store_id = p_store
     and p.category_id is not distinct from p_category;

  atual := array_position(ordenados, p_id);
  if atual is null then return; end if;

  alvo := case when p_direction = 'up' then atual - 1 else atual + 1 end;
  if alvo < 1 or alvo > array_length(ordenados, 1) then return; end if;

  ordenados[atual] := ordenados[alvo];
  ordenados[alvo] := p_id;

  -- Reescreve a lista inteira com posições densas, como antes: é o que
  -- conserta sozinho um sort_order duplicado. A diferença é que agora são
  -- quarenta linhas numa instrução, e não quarenta instruções.
  update public.products p
     set sort_order = nova.posicao - 1
    from unnest(ordenados) with ordinality as nova(id, posicao)
   where p.id = nova.id
     and p.store_id = p_store;
end;
$$;

create or replace function public.move_category(
  p_store uuid,
  p_id uuid,
  p_direction text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ordenados uuid[];
  atual int;
  alvo int;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction;
  end if;

  select array_agg(c.id order by c.sort_order, c.created_at, c.id)
    into ordenados
    from public.menu_categories c
   where c.store_id = p_store;

  atual := array_position(ordenados, p_id);
  if atual is null then return; end if;

  alvo := case when p_direction = 'up' then atual - 1 else atual + 1 end;
  if alvo < 1 or alvo > array_length(ordenados, 1) then return; end if;

  ordenados[atual] := ordenados[alvo];
  ordenados[alvo] := p_id;

  update public.menu_categories c
     set sort_order = nova.posicao - 1
    from unnest(ordenados) with ordinality as nova(id, posicao)
   where c.id = nova.id
     and c.store_id = p_store;
end;
$$;

-- Anônimo não reordena cardápio de ninguém.
revoke execute on function public.move_product(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.move_category(uuid, uuid, text)      from public, anon;

grant execute on function public.move_product(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.move_category(uuid, uuid, text)      to authenticated;
