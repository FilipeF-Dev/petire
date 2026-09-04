-- =============================================================================
-- Petire — métricas por intervalo
--
-- O painel pergunta "últimos 30 dias", que é uma janela deslizante. O relatório
-- mensal pergunta "agosto", que é um intervalo fechado — e nenhuma quantidade
-- de dias corridos responde isso: agosto tem 31 e fevereiro tem 28.
--
-- Em vez de uma segunda implementação da mesma contagem, o intervalo vira a
-- forma geral e a janela vira um caso dela. As duas funções antigas continuam
-- com a mesma assinatura e o mesmo retorno — nenhuma chamada muda — só param de
-- ter corpo próprio para divergir.
-- =============================================================================

create or replace function public.store_metrics_between(
  target  uuid,
  from_at timestamptz,
  to_at   timestamptz
)
returns table (
  store_views     bigint,
  cart_adds       bigint,
  whatsapp_clicks bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where e.kind = 'store_view'),
    count(*) filter (where e.kind = 'cart_add'),
    count(*) filter (where e.kind = 'whatsapp_click')
  from public.events e
  where e.store_id = target
    and e.created_at >= from_at
    and e.created_at <  to_at;
$$;

comment on function public.store_metrics_between(uuid, timestamptz, timestamptz) is
  'Contagem de eventos num intervalo fechado. Fim exclusivo, para meses vizinhos não contarem o mesmo evento duas vezes.';

create or replace function public.store_top_products_between(
  target   uuid,
  from_at  timestamptz,
  to_at    timestamptz,
  max_rows integer default 5
)
returns table (
  product_id uuid,
  name       text,
  adds       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.product_id, p.name, count(*)
  from public.events e
  join public.products p on p.id = e.product_id
  where e.store_id = target
    and e.kind = 'cart_add'
    and e.created_at >= from_at
    and e.created_at <  to_at
  group by e.product_id, p.name
  order by count(*) desc, p.name
  limit max_rows;
$$;

-- ----------------------------------------------------------------------------
-- As janelas deslizantes, agora escritas em cima do intervalo.
--
-- `now()` continua sendo o relógio do banco, que é o que gravou as linhas — o
-- relógio do servidor de render não tem nada a ver com elas.
-- ----------------------------------------------------------------------------

create or replace function public.store_metrics(
  target uuid,
  window_days integer default 30
)
returns table (
  store_views     bigint,
  cart_adds       bigint,
  whatsapp_clicks bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.store_metrics_between(
    target,
    now() - make_interval(days => window_days),
    now()
  );
$$;

create or replace function public.store_top_products(
  target uuid,
  window_days integer default 30,
  max_rows integer default 5
)
returns table (
  product_id uuid,
  name       text,
  adds       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.store_top_products_between(
    target,
    now() - make_interval(days => window_days),
    now(),
    max_rows
  );
$$;

revoke all on function public.store_metrics_between(uuid, timestamptz, timestamptz)
  from public;
grant execute on function public.store_metrics_between(uuid, timestamptz, timestamptz)
  to authenticated;

revoke all on function public.store_top_products_between(uuid, timestamptz, timestamptz, integer)
  from public;
grant execute on function public.store_top_products_between(uuid, timestamptz, timestamptz, integer)
  to authenticated;
