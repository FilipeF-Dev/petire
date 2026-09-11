-- =============================================================================
-- Petire — o Básico enxerga o número, o Plus enxerga a lista
--
-- O bloco do plano de cima dizia o que o recurso faz, e isso é uma oferta
-- genérica: a loja no Básico não sabia se a lista viria com sete itens ou
-- vazia. O número muda a conversa, porque ele é sobre o negócio **dela** —
-- sete buscas perto dela que o cardápio dela não atende, contadas agora.
--
-- A regra de casar termo com cardápio passa a morar num lugar só. Antes ela
-- vivia dentro de `store_unmet_demand`; com duas leituras da mesma coisa, uma
-- cópia seria a garantia de o número e a lista discordarem um dia — e o dia em
-- que isso acontecesse seria o dia em que o lojista pagou para ver sete itens
-- e encontrou cinco.
--
-- `store_unmet_demand_terms` não é executável por ninguém do navegador: ela é
-- a base sem trava de plano, e quem a chama são as duas funções abaixo.
-- =============================================================================

create or replace function public.store_unmet_demand_terms(
  target uuid,
  window_days integer default 30,
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

comment on function public.store_unmet_demand_terms(uuid, integer, integer) is
  'Base da demanda do bairro, sem trava de plano. Só as funções do Petire chamam.';

revoke all on function public.store_unmet_demand_terms(uuid, integer, integer)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- A lista: só o Plus
-- ----------------------------------------------------------------------------

create or replace function public.store_unmet_demand(
  target uuid,
  window_days integer default 30,
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
  select t.term, t.hits
  from public.store_unmet_demand_terms(target, window_days, min_hits) t
  -- O degrau continua no banco, e não só na tela: recurso pago que a chamada
  -- direta entrega não é recurso pago.
  where exists (
    select 1 from public.stores s where s.id = target and s.plan = 'plus'
  );
$$;

-- ----------------------------------------------------------------------------
-- O número: qualquer plano
--
-- Devolve quantos, nunca quais. É o que transforma "temos um recurso de dados"
-- em "há sete coisas acontecendo aqui perto agora" sem entregar a lista.
-- ----------------------------------------------------------------------------

create or replace function public.store_unmet_demand_count(
  target uuid,
  window_days integer default 30,
  min_hits integer default 3
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.store_unmet_demand_terms(target, window_days, min_hits);
$$;

comment on function public.store_unmet_demand_count(uuid, integer, integer) is
  'Quantos termos procurados no bairro o cardápio não atende. Sem revelar quais — o Básico vê o número.';

revoke all on function public.store_unmet_demand_count(uuid, integer, integer)
  from public, anon;
grant execute on function public.store_unmet_demand_count(uuid, integer, integer)
  to authenticated;
