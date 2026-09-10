-- =============================================================================
-- Petire — o que procuram no bairro e o cardápio da loja não tem
--
-- O Petire enxerga uma coisa que nenhum lojista enxerga sozinho: o que as
-- pessoas digitam na busca, perto dele. Até agora isso só servia para escolher
-- o próximo bairro. Vira o degrau do plano Plus porque é acionável na mesma
-- tela: viu que procuram açaí, clica em Cardápio, cadastra.
--
-- "Não tem" é medido pela **mesma régua da busca**: o termo é atendido se
-- existir um item da loja em que todas as palavras aparecem, no nome com
-- separador ou colado. Qualquer outra régua faria o painel prometer uma coisa
-- e a vitrine entregar outra.
--
-- SECURITY DEFINER, diferente de `store_metrics`, e por um motivo específico:
-- `demand_signals` tem RLS ligada e **nenhuma policy** — nem o gerente lê a
-- tabela. Então a função é a única porta, e ela é estreita de propósito:
-- confere `manages_store`, confere o plano, agrega, e devolve dez linhas sem
-- nada além de termo e contagem. Nunca uma linha crua.
-- =============================================================================

create or replace function public.store_unmet_demand(
  target uuid,
  window_days integer default 30,
  -- Piso duplo. Um termo procurado uma vez não é demanda, é ruído — e num
  -- bairro pequeno ele é praticamente a busca de uma pessoa identificável.
  min_hits integer default 3
)
returns table (
  term text,
  hits bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with loja as (
    select s.id, s.city_slug
    from public.stores s
    where s.id = target
      -- Sem isto, um gerente passaria o id do vizinho e leria a demanda dele.
      and public.manages_store(s.id)
      -- O degrau é do banco também, e não só da tela: recurso pago que a
      -- chamada direta entrega não é recurso pago.
      and s.plan = 'plus'
  ),
  procurado as (
    select d.term, count(*) as hits
    from public.demand_signals d
    join loja on d.city_slug = loja.city_slug
    where d.term is not null
      -- As duas contam: quem procurou e não achou nada, e quem achou no
      -- concorrente. Para esta loja as duas foram a mesma venda perdida.
      and d.kind in ('search_hit', 'search_empty')
      and d.created_at >= now() - make_interval(days => window_days)
    group by d.term
    having count(*) >= min_hits
  )
  select p.term, p.hits
  from procurado p
  where not exists (
    select 1
    from public.products prod
    join loja on prod.store_id = loja.id
    where not exists (
      select 1
      from unnest(regexp_split_to_array(public.slugify(p.term), '-')) as w(word)
      where w.word <> ''
        and prod.name_slug not like '%' || w.word || '%'
        and prod.name_compact not like '%' || w.word || '%'
    )
  )
  order by p.hits desc, p.term
  limit 10;
$$;

comment on function public.store_unmet_demand(uuid, integer, integer) is
  'Termos procurados na cidade da loja que o cardápio dela não atende. Plano Plus. Agregado, com piso de repetições.';

revoke all on function public.store_unmet_demand(uuid, integer, integer) from public, anon;
grant execute on function public.store_unmet_demand(uuid, integer, integer) to authenticated;
