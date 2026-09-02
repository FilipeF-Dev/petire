-- =============================================================================
-- Petire — schema inicial (MVP v1)
--
-- Convenções:
--   * Todo valor monetário é INTEGER em centavos. Nunca float.
--   * whatsapp_e164 é o número normalizado sem "+" e sem máscara: 5511987654321
--   * store_id é denormalizado nas tabelas filhas para que as políticas de RLS
--     não precisem de JOIN. A integridade é garantida por chaves compostas.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type public.store_kind as enum ('food', 'drinks', 'both');

create type public.subscription_status as enum (
  'trial',      -- período gratuito de onboarding
  'active',     -- mensalidade em dia
  'past_due',   -- atrasada, ainda visível (carência)
  'suspended'   -- oculta do catálogo público
);

create type public.promotion_kind as enum ('percent', 'fixed');

create type public.manager_role as enum ('manager', 'admin');

create type public.event_kind as enum ('store_view', 'cart_add', 'whatsapp_click');

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- stores
-- ----------------------------------------------------------------------------

create table public.stores (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  description         text,
  logo_url            text,
  cover_url           text,
  whatsapp_e164       text not null,
  address             text,
  city                text not null,
  neighborhood        text not null,
  lat                 double precision,
  lng                 double precision,
  cuisine_tags        text[] not null default '{}',
  kind                public.store_kind not null default 'food',
  delivery_fee_cents  integer not null default 0,
  min_order_cents     integer not null default 0,

  -- Visibilidade e cobrança. Só o service_role escreve nestas três colunas
  -- (ver GRANTs de coluna na migration de RLS).
  is_active           boolean not null default false,
  subscription_status public.subscription_status not null default 'trial',
  subscription_until  date,

  -- null  = segue store_hours
  -- true  = forçado aberto
  -- false = forçado fechado ("fechei mais cedo hoje")
  is_open_manual      boolean,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint stores_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint stores_whatsapp_format
    check (whatsapp_e164 ~ '^[1-9][0-9]{9,14}$'),
  constraint stores_name_not_blank
    check (length(btrim(name)) > 0),
  constraint stores_delivery_fee_nonneg
    check (delivery_fee_cents >= 0),
  constraint stores_min_order_nonneg
    check (min_order_cents >= 0),
  constraint stores_lat_range
    check (lat is null or lat between -90 and 90),
  constraint stores_lng_range
    check (lng is null or lng between -180 and 180)
);

comment on column public.stores.whatsapp_e164 is
  'E.164 sem "+": código do país + DDD + número. Ex.: 5511987654321';
comment on column public.stores.is_open_manual is
  'null = segue store_hours; true/false = override manual do gerente';

create index stores_city_neighborhood_idx
  on public.stores (city, neighborhood)
  where is_active;

create index stores_cuisine_tags_idx
  on public.stores using gin (cuisine_tags);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- store_hours
--   Múltiplas faixas por dia são permitidas (almoço e jantar).
--   closes_at < opens_at significa que a faixa cruza a meia-noite (18:00–02:00).
-- ----------------------------------------------------------------------------

create table public.store_hours (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6), -- 0 = domingo
  opens_at   time not null,
  closes_at  time not null,
  created_at timestamptz not null default now(),

  constraint store_hours_range_not_empty check (opens_at <> closes_at)
);

create index store_hours_store_weekday_idx
  on public.store_hours (store_id, weekday);

-- ----------------------------------------------------------------------------
-- menu_categories
-- ----------------------------------------------------------------------------

create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menu_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint menu_categories_unique_name unique (store_id, name),
  -- alvo da chave composta em products
  constraint menu_categories_id_store_key unique (id, store_id)
);

create index menu_categories_store_sort_idx
  on public.menu_categories (store_id, sort_order);

create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- products
--   A FK composta (category_id, store_id) impede que um produto aponte para a
--   categoria de outra loja.
-- ----------------------------------------------------------------------------

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  category_id  uuid,
  name         text not null,
  description  text,
  price_cents  integer not null,
  image_url    text,
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_price_nonneg check (price_cents >= 0),
  constraint products_category_same_store
    foreign key (category_id, store_id)
    references public.menu_categories (id, store_id)
    on delete set null,
  -- alvo das chaves compostas em option_groups e promotions
  constraint products_id_store_key unique (id, store_id)
);

create index products_store_category_sort_idx
  on public.products (store_id, category_id, sort_order);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- option_groups
--   "Tamanho" (min 1, max 1), "Adicionais" (min 0, max 5), "Remover" (min 0).
--   Obrigatório é o mesmo que min_select >= 1, então não existe coluna
--   `required` — ela poderia divergir do min_select.
-- ----------------------------------------------------------------------------

create table public.option_groups (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null,
  product_id uuid not null,
  name       text not null,
  min_select smallint not null default 0,
  max_select smallint not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint option_groups_name_not_blank check (length(btrim(name)) > 0),
  constraint option_groups_min_nonneg check (min_select >= 0),
  constraint option_groups_max_positive check (max_select >= 1),
  constraint option_groups_max_gte_min check (max_select >= min_select),
  constraint option_groups_product_same_store
    foreign key (product_id, store_id)
    references public.products (id, store_id)
    on delete cascade,
  -- alvo da chave composta em options
  constraint option_groups_id_store_key unique (id, store_id)
);

create index option_groups_product_sort_idx
  on public.option_groups (product_id, sort_order);

create trigger option_groups_set_updated_at
  before update on public.option_groups
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- options
--   price_delta_cents pode ser negativo ("sem queijo, -R$ 2,00").
-- ----------------------------------------------------------------------------

create table public.options (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null,
  group_id          uuid not null,
  name              text not null,
  price_delta_cents integer not null default 0,
  is_available      boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint options_name_not_blank check (length(btrim(name)) > 0),
  constraint options_group_same_store
    foreign key (group_id, store_id)
    references public.option_groups (id, store_id)
    on delete cascade
);

create index options_group_sort_idx
  on public.options (group_id, sort_order);

create trigger options_set_updated_at
  before update on public.options
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- promotions
--   product_id null = promoção da loja inteira.
--   percent: value é 1–100.  fixed: value é o desconto em centavos.
-- ----------------------------------------------------------------------------

create table public.promotions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  product_id uuid,
  kind       public.promotion_kind not null,
  value      integer not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promotions_value_positive check (value > 0),
  constraint promotions_percent_range
    check (kind <> 'percent' or value between 1 and 100),
  constraint promotions_window_valid
    check (ends_at is null or ends_at > starts_at),
  constraint promotions_product_same_store
    foreign key (product_id, store_id)
    references public.products (id, store_id)
    on delete cascade
);

create index promotions_store_active_idx
  on public.promotions (store_id)
  where is_active;

create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- managers
--   1:1 com auth.users. role 'admin' não tem store_id (enxerga tudo).
-- ----------------------------------------------------------------------------

create table public.managers (
  id         uuid primary key references auth.users(id) on delete cascade,
  store_id   uuid references public.stores(id) on delete cascade,
  role       public.manager_role not null default 'manager',
  email      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint managers_store_required_for_manager
    check (role = 'admin' or store_id is not null)
);

create index managers_store_idx on public.managers (store_id);

create trigger managers_set_updated_at
  before update on public.managers
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- events
--   O pedido é fechado no WhatsApp, fora do sistema. Esta tabela é a única
--   prova de valor que sobra na hora de renovar a assinatura.
-- ----------------------------------------------------------------------------

create table public.events (
  id         bigint generated always as identity primary key,
  store_id   uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  kind       public.event_kind not null,
  created_at timestamptz not null default now()
);

create index events_store_kind_created_idx
  on public.events (store_id, kind, created_at desc);

-- ----------------------------------------------------------------------------
-- store_is_open — a loja está aberta agora?
-- ----------------------------------------------------------------------------

create or replace function public.store_is_open(
  target uuid,
  at_time timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select is_active, subscription_status, is_open_manual
    from public.stores
    where id = target
  ),
  -- Horário de Brasília. Revisar quando o Petire sair de um único fuso.
  loc as (
    select (at_time at time zone 'America/Sao_Paulo') as ts
  ),
  open_by_hours as (
    select exists (
      select 1
      from public.store_hours h, loc
      where h.store_id = target
        and (
          -- faixa dentro do mesmo dia
          (h.closes_at > h.opens_at
            and h.weekday = extract(dow from loc.ts)::smallint
            and loc.ts::time >= h.opens_at
            and loc.ts::time <  h.closes_at)
          -- faixa que cruza a meia-noite, parte da noite
          or (h.closes_at < h.opens_at
            and h.weekday = extract(dow from loc.ts)::smallint
            and loc.ts::time >= h.opens_at)
          -- faixa que cruza a meia-noite, madrugada do dia seguinte
          or (h.closes_at < h.opens_at
            and h.weekday = ((extract(dow from loc.ts)::int + 6) % 7)::smallint
            and loc.ts::time < h.closes_at)
        )
    ) as v
  )
  select
    s.is_active
    and s.subscription_status <> 'suspended'
    and coalesce(s.is_open_manual, open_by_hours.v)
  from s, open_by_hours;
$$;

comment on function public.store_is_open(uuid, timestamptz) is
  'Aberta agora? Considera override manual, horários (inclusive faixas que cruzam a meia-noite) e status da assinatura.';
