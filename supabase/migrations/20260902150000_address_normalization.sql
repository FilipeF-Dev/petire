-- =============================================================================
-- Petire — endereço com CEP e agrupamento à prova de digitação
--
-- O problema: `city` e `neighborhood` são texto livre. "Vila Madalena" e
-- "vila madalena" viram dois bairros diferentes na home, e o filtro separa as
-- lojas — o cliente procura no bairro certo e não acha a lanchonete.
--
-- São duas correções, e as duas fazem falta:
--
--   1. CEP na entrada. O ViaCEP devolve cidade, UF e o código IBGE do
--      município, que é o identificador canônico e não depende de grafia.
--   2. Colunas normalizadas na saída. O CEP resolve a cidade, mas cidade
--      pequena tem CEP único e vem sem bairro — o bairro continua digitado.
--      Só a normalização garante que a mesma coisa escrita de dois jeitos
--      agrupe junto.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- slugify — precisa ser IMMUTABLE para servir de coluna gerada
-- ----------------------------------------------------------------------------

create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  -- `nullif` é construção da linguagem, não função: não aceita schema.
  select nullif(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.lower(
          pg_catalog.translate(
            input,
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+)|(-+$)', '', 'g'
    ),
    ''
  );
$$;

comment on function public.slugify(text) is
  'Normaliza texto para agrupamento e URL. IMMUTABLE porque alimenta colunas geradas.';

-- ----------------------------------------------------------------------------
-- Novas colunas
-- ----------------------------------------------------------------------------

alter table public.stores
  add column cep text,
  add column state_uf text,
  -- Código do município no IBGE, como vem do ViaCEP. Duas lojas na mesma
  -- cidade têm o mesmo código mesmo que alguém escreva o nome diferente.
  add column ibge_code text;

alter table public.stores
  add constraint stores_cep_format
    check (cep is null or cep ~ '^[0-9]{8}$'),
  add constraint stores_uf_format
    check (state_uf is null or state_uf ~ '^[A-Z]{2}$'),
  add constraint stores_ibge_format
    check (ibge_code is null or ibge_code ~ '^[0-9]{7}$');

comment on column public.stores.cep is 'Só dígitos, sem hífen.';
comment on column public.stores.ibge_code is
  'Código IBGE do município, vindo do ViaCEP. Identificador canônico da cidade.';

-- Geradas pelo banco: não dá para o app esquecer de atualizar, nem para uma
-- edição no painel do lojista recriar a divergência.
alter table public.stores
  add column city_slug text generated always as (public.slugify(city)) stored,
  add column neighborhood_slug text
    generated always as (public.slugify(neighborhood)) stored;

create index stores_place_idx
  on public.stores (city_slug, neighborhood_slug)
  where is_active;

-- ----------------------------------------------------------------------------
-- Privilégios das colunas novas
-- ----------------------------------------------------------------------------

grant select (cep, state_uf, ibge_code, city_slug, neighborhood_slug)
  on public.stores to anon;

-- Colunas geradas não são atualizáveis, então ficam de fora do UPDATE.
grant update (cep, state_uf, ibge_code) on public.stores to authenticated;

-- ----------------------------------------------------------------------------
-- Views públicas
-- ----------------------------------------------------------------------------

drop view public.neighborhoods_public;
drop view public.stores_public;

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
  public.store_is_open(s.id) as is_open_now
from public.stores s
where public.store_is_public(s.id);

comment on view public.stores_public is
  'Catálogo público: só lojas ativas e não suspensas, com o status de aberto já resolvido.';

grant select on public.stores_public to anon, authenticated;

-- O agrupamento é pelo slug; o nome exibido é a grafia mais usada entre as
-- lojas daquele bairro, para uma digitação torta não virar o rótulo oficial.
create view public.neighborhoods_public
with (security_invoker = true)
as
select
  s.city_slug,
  s.neighborhood_slug,
  -- A view não tem search_path fixo, então não precisa qualificar.
  mode() within group (order by s.city) as city,
  mode() within group (order by s.neighborhood) as neighborhood,
  mode() within group (order by s.state_uf) as state_uf,
  count(*)::int as store_count
from public.stores s
where public.store_is_public(s.id)
  -- slugify devolve null quando não sobra nenhum caractere aproveitável
  -- (um bairro escrito só com pontuação). Sem slug não há como montar o
  -- link do bairro, então esse grupo não existe para a vitrine.
  and s.city_slug is not null
  and s.neighborhood_slug is not null
group by s.city_slug, s.neighborhood_slug;

grant select on public.neighborhoods_public to anon, authenticated;
