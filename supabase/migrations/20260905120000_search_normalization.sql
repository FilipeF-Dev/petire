-- =============================================================================
-- Petire — busca que perdoa acento, hífen e caixa
--
-- A busca comparava o texto digitado com o texto cadastrado, letra por letra.
-- Quem digita "coca cola" não encontra "Coca-Cola"; quem digita "acai" não
-- encontra "Açaí"; quem digita "X Salada" não encontra "X-Salada". E o produto
-- aposta justamente em achar a loja pelo que ela vende — quem procura já não
-- sabe o nome da lanchonete que faz coxinha, é por isso que está procurando.
--
-- A normalização já existe e já é usada para agrupar bairro e cidade:
-- `public.slugify()`. Ela derruba acento, caixa e pontuação de uma vez, e a
-- pontuação virar hífen é o que faz "coca cola", "Coca-Cola" e "COCA COLA"
-- caírem todas em "coca-cola".
--
-- Colunas geradas pelo mesmo motivo de `city_slug`: o app não tem como
-- esquecer de atualizar, e uma edição no painel do lojista não tem como
-- recriar a divergência.
--
-- Sem índice de propósito. `like '%x%'` não usa índice comum, e um GIN de
-- trigrama custa uma extensão e manutenção de escrita para varrer algumas
-- centenas de linhas — que é o tamanho de um bairro. Quando um catálogo
-- justificar, o índice entra sozinho, sem mexer em nada disto.
-- =============================================================================

alter table public.products
  add column name_slug text generated always as (public.slugify(name)) stored;

comment on column public.products.name_slug is
  'Nome normalizado para busca. Gêmeo de slugify() em src/lib/slug.ts.';

alter table public.stores
  add column name_slug text generated always as (public.slugify(name)) stored;

comment on column public.stores.name_slug is
  'Nome normalizado para busca. Gêmeo de slugify() em src/lib/slug.ts.';

-- `products` tem grant de select na tabela inteira; `stores` é por coluna.
grant select (name_slug) on public.stores to anon;

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
  s.name_slug
from public.stores s
where public.store_is_public(s.id);
