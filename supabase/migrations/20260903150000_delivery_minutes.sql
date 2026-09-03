-- =============================================================================
-- Petire — tempo médio de entrega
--
-- "Quanto tempo demora?" é a pergunta que o cliente faz antes de pedir, e hoje
-- ela só é respondida depois — no WhatsApp, com a loja já ocupada. Quem não
-- responde perde o pedido para quem responde.
--
-- É o tempo **depois que a loja confirma**, não desde o clique: o intervalo até
-- alguém ler a mensagem não está sob controle de ninguém, e prometer por ele
-- seria prometer o que não se cumpre.
--
-- Nulo é uma resposta válida: a loja que não sabe estimar não mostra nada, em
-- vez de chutar um número que vai errar todo dia.
-- =============================================================================

alter table public.stores
  add column delivery_minutes smallint;

alter table public.stores
  add constraint stores_delivery_minutes_range
    check (delivery_minutes is null or delivery_minutes between 5 and 240);

comment on column public.stores.delivery_minutes is
  'Tempo médio de entrega em minutos, contado da confirmação do pedido. Nulo = não informado.';

-- O lojista é quem sabe quanto demora a própria entrega.
grant update (delivery_minutes) on public.stores to authenticated;

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
  s.delivery_minutes
from public.stores s
where public.store_is_public(s.id);

-- A vitrine lê a view, mas o anon precisa da coluna na tabela por baixo dela.
grant select (delivery_minutes) on public.stores to anon;
