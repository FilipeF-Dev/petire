-- =============================================================================
-- Petire — projeção pública das lojas
--
-- A vitrine precisa de duas coisas que a tabela não dá de graça: saber se a
-- loja está aberta agora, e não expor a situação da assinatura para quem só
-- quer pedir um lanche.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Visitante não precisa saber da assinatura
--
-- Privilégio de coluna, não policy: a policy decide quais LINHAS aparecem, e
-- para o catálogo público a linha inteira precisa aparecer mesmo.
-- `authenticated` continua lendo tudo — o gerente vê o próprio vencimento no
-- painel.
-- ----------------------------------------------------------------------------

revoke select on public.stores from anon;

grant select (
  id, slug, name, description, logo_url, cover_url, whatsapp_e164,
  address, city, neighborhood, lat, lng, cuisine_tags, kind,
  delivery_fee_cents, min_order_cents, is_open_manual,
  created_at, updated_at
) on public.stores to anon;

-- ----------------------------------------------------------------------------
-- stores_public — o que a vitrine lê
--
-- security_invoker: o RLS de public.stores continua valendo para quem consulta.
-- A cláusula WHERE usa store_is_public() em vez de ler is_active e
-- subscription_status direto, justamente porque o anon não tem mais SELECT
-- nessas colunas — a função é SECURITY DEFINER e as lê por conta própria.
-- ----------------------------------------------------------------------------

create view public.stores_public
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
  s.city,
  s.neighborhood,
  s.lat,
  s.lng,
  s.cuisine_tags,
  s.kind,
  s.delivery_fee_cents,
  s.min_order_cents,
  public.store_is_open(s.id) as is_open_now
from public.stores s
where public.store_is_public(s.id);

comment on view public.stores_public is
  'Catálogo público: só lojas ativas e não suspensas, com o status de aberto já resolvido.';

grant select on public.stores_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- neighborhoods_public — alimenta o seletor de bairro da home
-- ----------------------------------------------------------------------------

create view public.neighborhoods_public
with (security_invoker = true)
as
select
  s.city,
  s.neighborhood,
  count(*)::int as store_count
from public.stores s
where public.store_is_public(s.id)
group by s.city, s.neighborhood;

grant select on public.neighborhoods_public to anon, authenticated;
