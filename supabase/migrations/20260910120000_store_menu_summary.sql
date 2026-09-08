-- =============================================================================
-- Petire — o resumo do cardápio de cada loja, somado no banco
--
-- O `/admin` lia a tabela de produtos inteira para contar itens por loja e
-- descobrir quando cada cardápio foi mexido pela última vez. Isso tem um teto
-- que ninguém vê: o PostgREST devolve no máximo `max_rows` linhas — mil, por
-- padrão, na nuvem e aqui.
--
-- A conta do estrago: a mil produtos, com uns 40 itens por cardápio, o corte
-- chega na **vigésima quinta loja**. E chega em silêncio. A página abre, não dá
-- erro, e as lojas que caíram fora aparecem com zero itens e sem aviso de
-- cardápio parado — que é justamente o sinal que existe para dizer com quem
-- falar.
--
-- Somar aqui troca "uma linha por produto" por "uma linha por loja". O mesmo
-- teto de mil passa a valer para lojas, não para itens: de 25 para 1.000, e a
-- essa altura a lista do admin precisa de paginação por outros motivos.
--
-- Mesma escolha de `store_metrics`: a agregação é do banco, que é quem tem os
-- dados, e a janela de tempo é do relógio dele.
-- =============================================================================

create or replace function public.store_menu_summary()
returns table (
  store_id  uuid,
  items     bigint,
  available bigint,
  last_edit timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.store_id,
    count(*),
    count(*) filter (where p.is_available),
    max(p.updated_at)
  from public.products p
  -- Só o admin. Sem isto, um gerente logado receberia a contagem de itens e a
  -- data de edição de todo cardápio público — nada secreto, dá para deduzir
  -- navegando, mas entregar de bandeja o ritmo de trabalho do concorrente é
  -- outra coisa. Sem ser admin, a função devolve lista vazia em vez de erro,
  -- do mesmo jeito que `store_metrics` devolve zeros para a loja do vizinho.
  where public.is_admin()
  group by p.store_id;
$$;

comment on function public.store_menu_summary() is
  'Itens, disponíveis e última edição por loja. Uma linha por loja, não por produto: é o que tira o /admin do teto de mil linhas do PostgREST.';

revoke all on function public.store_menu_summary() from public;
grant execute on function public.store_menu_summary() to authenticated;
