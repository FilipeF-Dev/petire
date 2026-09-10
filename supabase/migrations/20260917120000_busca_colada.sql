-- =============================================================================
-- Petire — busca que perdoa a palavra colada
--
-- "x-tudo" e "x tudo" encontram o X-Tudo; "xtudo" não encontrava nada. O
-- motivo: o banco guarda `name_slug = 'x-tudo'` e a busca procura o pedaço
-- digitado dentro dele — e "xtudo" não está lá, por causa do hífen no meio.
--
-- Quem digita colado é quem escreve rápido, no celular, com fome. É o mesmo
-- cliente de "cocacola", "aguacomgas" e "paodequeijo", e hoje os três recebem
-- uma tela vazia sobre um cardápio que tem exatamente o que eles pediram.
--
-- A correção é guardar também a forma sem separador nenhum e procurar nas
-- duas. Coluna gerada pelo mesmo motivo de `name_slug`: o app não tem como
-- esquecer de atualizar, e uma edição no painel não tem como recriar a
-- divergência.
--
-- Continua sem índice, pelo mesmo motivo registrado em
-- 20260905120000_search_normalization.sql: `like '%x%'` não usa índice comum,
-- e varrer algumas centenas de linhas — o tamanho de um bairro — sai mais
-- barato que manter um GIN de trigrama a cada escrita.
-- =============================================================================

alter table public.products
  add column name_compact text
  generated always as (replace(public.slugify(name), '-', '')) stored;

comment on column public.products.name_compact is
  'Nome normalizado e sem separadores, para quem digita colado. Gêmeo de compact() em src/lib/slug.ts.';

alter table public.stores
  add column name_compact text
  generated always as (replace(public.slugify(name), '-', '')) stored;

comment on column public.stores.name_compact is
  'Nome normalizado e sem separadores, para quem digita colado. Gêmeo de compact() em src/lib/slug.ts.';

-- `products` tem grant de select na tabela inteira; `stores` é por coluna.
grant select (name_compact) on public.stores to anon;

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
  s.free_delivery,
  s.name_compact
from public.stores s
where public.store_is_public(s.id);
