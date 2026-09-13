-- =============================================================================
-- Petire — a loja que não faz entrega
--
-- Apareceu no cadastro de uma lanchonete de verdade: ela recebe o pedido pelo
-- WhatsApp e o cliente busca no balcão. Não entrega, e nunca vai entregar.
--
-- Até aqui o modelo tinha entrega como fato consumado: toda loja tem taxa,
-- todo carrinho soma essa taxa, e o carrinho pede o endereço de quem recebe.
-- Para essa lanchonete, a taxa era uma linha "Entrega: grátis" que promete o
-- que ela não faz, e o endereço era um formulário que não serve para nada — e
-- que, pior, faz o cliente esperar uma entrega que não vem.
--
-- O campo tem três valores e não dois porque a rua tem três: tem quem só
-- entrega, quem só atende no balcão, e — a maioria — quem faz as duas coisas.
-- Com dois valores, essa maioria teria de mentir num dos lados.
--
-- `delivery` como padrão porque é o que todas as lojas de hoje fazem: a coluna
-- nasce descrevendo a verdade que já está no ar, e ninguém precisa reabrir o
-- painel para o site continuar certo.
-- =============================================================================

create type public.service_mode as enum ('delivery', 'pickup', 'both');

alter table public.stores
  add column service_mode public.service_mode not null default 'delivery';

comment on column public.stores.service_mode is
  'Entrega, retirada no balcão, ou os dois. Decide se a taxa entra na conta e se o carrinho pede endereço.';

-- ----------------------------------------------------------------------------
-- Quem pode ler e escrever
--
-- `stores` é por coluna, ao contrário das outras tabelas: a vitrine é anônima
-- e cada coluna exposta é uma decisão.
-- ----------------------------------------------------------------------------

grant select (service_mode) on public.stores to anon;

-- O lojista muda isso sozinho: é informação dele sobre o negócio dele, como o
-- horário e a taxa. Não é o caso de virar pedido para o suporte.
grant update (service_mode) on public.stores to authenticated;

-- ----------------------------------------------------------------------------
-- Vitrine
--
-- `create or replace view` só aceita coluna nova no fim da lista, e é o que
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
  s.free_delivery,
  s.name_compact,
  s.service_mode
from public.stores s
where public.store_is_public(s.id);
