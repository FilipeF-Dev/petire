-- =============================================================================
-- Petire — events não cresce para sempre
--
-- `events` é a única prova de valor que existe, porque o pedido fecha no
-- WhatsApp, fora do sistema. Por isso nunca foi apagado. Só que nada lê além de
-- 60 dias no painel, e a tabela acumula para sempre: a umas 500 mil linhas por
-- mês no volume de mil lojas, é dívida silenciosa — não quebra nada até o dia
-- em que quebra.
--
-- Apagar direto o que passa de 90 dias tem um problema, e é o que decide o
-- desenho: o **relatório mensal navega meses para trás**. Com poda seca, agosto
-- viraria zero em novembro, sem erro nenhum na tela — exatamente o tipo de
-- mentira silenciosa que este projeto passou o tempo todo caçando. E é um
-- recurso do plano pago.
--
-- Então some antes de apagar. O mês fechado vira uma linha por loja, que é
-- barato de guardar para sempre, e a linha crua some depois.
--
--   linha crua      -> 90 dias
--   mês somado      -> para sempre, ~1 linha por loja por mês
--   itens do mês    -> os 10 mais, por loja e mês
-- =============================================================================

create table public.store_month_metrics (
  store_id        uuid not null references public.stores(id) on delete cascade,
  -- Primeiro dia do mês, no fuso de Brasília.
  month           date not null,
  store_views     integer not null default 0,
  cart_adds       integer not null default 0,
  whatsapp_clicks integer not null default 0,
  created_at      timestamptz not null default now(),

  primary key (store_id, month)
);

comment on table public.store_month_metrics is
  'Mês fechado, somado antes de a linha crua ser apagada. É o que faz o relatório mensal sobreviver à poda.';

create table public.store_month_top_products (
  store_id   uuid not null references public.stores(id) on delete cascade,
  month      date not null,
  -- Fica nulo se o item for apagado depois; o nome permanece, senão o
  -- relatório de agosto perderia o item que saiu do cardápio em setembro.
  product_id uuid references public.products(id) on delete set null,
  name       text not null,
  adds       integer not null,

  primary key (store_id, month, name)
);

comment on table public.store_month_top_products is
  'Os itens mais adicionados de cada mês fechado. Guarda o nome, não só o id: item apagado depois não pode sumir do relatório antigo.';

-- Mesmo acesso das métricas cruas: o gerente lê o da própria loja.
revoke all on public.store_month_metrics       from anon, authenticated;
revoke all on public.store_month_top_products  from anon, authenticated;
grant select on public.store_month_metrics      to authenticated;
grant select on public.store_month_top_products to authenticated;

alter table public.store_month_metrics      enable row level security;
alter table public.store_month_top_products enable row level security;

create policy store_month_metrics_select_manager on public.store_month_metrics
  for select to authenticated
  using (public.manages_store(store_id));

create policy store_month_top_products_select_manager on public.store_month_top_products
  for select to authenticated
  using (public.manages_store(store_id));

-- ----------------------------------------------------------------------------
-- Somar, depois apagar
-- ----------------------------------------------------------------------------

create or replace function public.maintain_events(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
  cutoff  date;
begin
  -- Só mês fechado. O mês em curso ainda vai receber evento, e uma soma
  -- parcial gravada agora nunca mais seria corrigida — ver o `do nothing`
  -- abaixo.
  cutoff := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;

  insert into public.store_month_metrics
    (store_id, month, store_views, cart_adds, whatsapp_clicks)
  select
    e.store_id,
    date_trunc('month', (e.created_at at time zone 'America/Sao_Paulo'))::date,
    count(*) filter (where e.kind = 'store_view'),
    count(*) filter (where e.kind = 'cart_add'),
    count(*) filter (where e.kind = 'whatsapp_click')
  from public.events e
  where (e.created_at at time zone 'America/Sao_Paulo') < cutoff
  group by 1, 2
  -- DO NOTHING, e não DO UPDATE: depois da poda, recalcular um mês antigo daria
  -- zero — e sobrescreveria a soma boa com esse zero. Mês somado uma vez está
  -- somado.
  on conflict (store_id, month) do nothing;

  insert into public.store_month_top_products
    (store_id, month, product_id, name, adds)
  select ranked.store_id, ranked.month, ranked.product_id, ranked.name, ranked.adds
  from (
    -- Somar e ranquear em passos separados: o `partition by` de uma janela
    -- precisa casar com uma expressão do `group by`, e a do mês leva um cast
    -- para `date` — o que basta para o Postgres tratar as duas como
    -- expressões diferentes.
    select
      monthly.*,
      row_number() over (
        partition by monthly.store_id, monthly.month
        order by monthly.adds desc, monthly.name
      ) as position
    from (
      select
        e.store_id,
        date_trunc('month', (e.created_at at time zone 'America/Sao_Paulo'))::date as month,
        e.product_id,
        p.name,
        count(*)::integer as adds
      from public.events e
      join public.products p on p.id = e.product_id
      where e.kind = 'cart_add'
        and (e.created_at at time zone 'America/Sao_Paulo') < cutoff
      group by 1, 2, 3, 4
    ) monthly
  ) ranked
  where ranked.position <= 10
  on conflict (store_id, month, name) do nothing;

  delete from public.events
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.maintain_events(integer) is
  'Soma os meses fechados e apaga a linha crua além da retenção. Roda pelo pg_cron; a ordem importa.';

-- Trabalho de manutenção: ninguém do browser executa isto.
revoke all on function public.maintain_events(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- O relatório passa a ler a soma, com o cru como reserva
--
-- Read-through: se o mês já foi somado, vem da soma; se ainda não — o mês que
-- acabou de fechar, antes de a rotina da madrugada rodar — é contado na hora.
-- Assim o relatório nunca tem um buraco de um dia.
-- ----------------------------------------------------------------------------

create or replace function public.store_month_report(
  target      uuid,
  month_start date
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
  with rolled as (
    select
      m.store_views::bigint,
      m.cart_adds::bigint,
      m.whatsapp_clicks::bigint
    from public.store_month_metrics m
    where m.store_id = target
      and m.month = month_start
  ),
  live as (
    select
      count(*) filter (where e.kind = 'store_view'),
      count(*) filter (where e.kind = 'cart_add'),
      count(*) filter (where e.kind = 'whatsapp_click')
    from public.events e
    where e.store_id = target
      and e.created_at >= (month_start::timestamp at time zone 'America/Sao_Paulo')
      and e.created_at <  ((month_start + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
  )
  select * from rolled
  union all
  select * from live where not exists (select 1 from rolled);
$$;

create or replace function public.store_month_top(
  target      uuid,
  month_start date,
  max_rows    integer default 10
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
  with rolled as (
    select t.product_id, t.name, t.adds::bigint
    from public.store_month_top_products t
    where t.store_id = target
      and t.month = month_start
    order by t.adds desc, t.name
    limit max_rows
  ),
  live as (
    select e.product_id, p.name, count(*)
    from public.events e
    join public.products p on p.id = e.product_id
    where e.store_id = target
      and e.kind = 'cart_add'
      and e.created_at >= (month_start::timestamp at time zone 'America/Sao_Paulo')
      and e.created_at <  ((month_start + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
    group by e.product_id, p.name
    order by count(*) desc, p.name
    limit max_rows
  )
  select * from rolled
  union all
  select * from live where not exists (select 1 from rolled);
$$;

revoke all on function public.store_month_report(uuid, date) from public;
grant execute on function public.store_month_report(uuid, date) to authenticated;

revoke all on function public.store_month_top(uuid, date, integer) from public;
grant execute on function public.store_month_top(uuid, date, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- A rotina
--
-- 04:17 para não cair na hora cheia, quando todo mundo agenda as coisas dele.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'petire-manter-events',
  '17 4 * * *',
  $cron$ select public.maintain_events(); $cron$
);
