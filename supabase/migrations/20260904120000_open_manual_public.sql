-- =============================================================================
-- Petire — por que a loja está fechada
--
-- A vitrine já sabia *que* a loja está fechada (`is_open_now`), mas não por
-- quê. E as duas respostas levam a telas diferentes:
--
--   fechada pelo horário  → "abre amanhã às 09:00", que é uma promessa útil;
--   fechada na mão        → não há hora de abrir, e prometer uma seria mentir.
--
-- `store_is_open()` resolve as duas num booleano só (`coalesce(is_open_manual,
-- pelos horários)`), então a distinção se perde. Expor a coluna devolve ao
-- cliente a informação que decide se ele espera ou procura outra loja.
--
-- Nulo = segue o horário cadastrado. True/false = o lojista mandou abrir ou
-- fechar agora, e isso ganha do horário.
-- =============================================================================

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
  s.is_open_manual
from public.stores s
where public.store_is_public(s.id);

-- A vitrine lê a view, mas o anon precisa da coluna na tabela por baixo dela.
grant select (is_open_manual) on public.stores to anon;
