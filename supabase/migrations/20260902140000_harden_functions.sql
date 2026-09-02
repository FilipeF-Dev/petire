-- =============================================================================
-- Petire — fecha o search_path das duas funções que ficaram de fora
--
-- Apontado pelo linter do Supabase (`npx supabase db advisors`).
--
-- Sem `search_path` fixo, quem controlar o search_path da sessão pode fazer
-- `now()` ou `split_part()` resolverem para uma função própria. Em
-- `storage_store_id` isso é concreto: ela decide de qual loja é o arquivo, e
-- é o que a policy do bucket usa para permitir ou negar a escrita.
--
-- `pg_catalog` continua sendo procurado primeiro mesmo com o search_path
-- vazio, então os operadores (`~`, `=`) seguem resolvendo; só as funções
-- precisam de nome completo.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.storage_store_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.split_part(object_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then pg_catalog.split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;
