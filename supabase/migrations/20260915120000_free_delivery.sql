-- =============================================================================
-- Petire — entrega grátis é uma afirmação, não a ausência de um número
--
-- A vitrine já mostrava "entrega a combinar" quando `delivery_fee_cents` era
-- zero, e isso continua certo: a taxa nasce zerada no cadastro, então zero quer
-- dizer "o lojista ainda não informou" na esmagadora maioria das lojas.
-- Anunciar entrega grátis em nome dele seria prometer o que ele não prometeu.
--
-- Só que o cliente quer filtrar por isso, e não há como filtrar pelo que
-- ninguém declarou. Então a loja declara: uma coluna própria, marcada por quem
-- entrega de graça. Zero continua sendo "não informou"; grátis passa a ser uma
-- coisa que alguém disse.
--
-- Nasce `false` para todo mundo, inclusive para quem já está no catálogo. É o
-- padrão certo: ninguém é anunciado como frete grátis sem ter dito que é.
-- =============================================================================

alter table public.stores
  add column free_delivery boolean not null default false;

comment on column public.stores.free_delivery is
  'A loja declarou que entrega de graça. Diferente de delivery_fee_cents = 0, que é "não informou".';

-- Quem entrega é a loja, então quem declara é ela.
grant update (free_delivery) on public.stores to authenticated;

-- A vitrine lê a view, mas o anon precisa da coluna na tabela por baixo dela.
grant select (free_delivery) on public.stores to anon;

-- ----------------------------------------------------------------------------
-- Vitrine
--
-- `create or replace view` só aceita colunas novas no fim da lista, e é o que
-- esta faz — a ordem das anteriores fica intacta.
-- ----------------------------------------------------------------------------

create or replace view public.stores_public
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.name,
  s.description,
  s.logo_url,
  s.cover_url,
  s.whatsapp_e164,
  s.address,
  s.cep,
  s.city,
  s.city_slug,
  s.neighborhood,
  s.neighborhood_slug,
  s.state_uf,
  s.lat,
  s.lng,
  s.cuisine_tags,
  s.kind,
  s.delivery_fee_cents,
  s.min_order_cents,
  public.store_is_open(s.id) as is_open_now,
  s.delivery_minutes,
  s.is_open_manual,
  s.name_slug,
  s.free_delivery
from public.stores s
where public.store_is_public(s.id);
