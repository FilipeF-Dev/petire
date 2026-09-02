-- =============================================================================
-- Petire — Row Level Security
--
-- Três atores:
--   anon          cliente do site, sem login. Só lê o catálogo público.
--   authenticated gerente logado. Lê/escreve o cardápio da própria loja.
--   service_role  servidor (admin, escrita de eventos). Ignora RLS.
--
-- O que o gerente NÃO pode fazer, por privilégio de coluna e não por policy:
--   ativar a própria loja, mudar o status ou o vencimento da assinatura.
--   Isso é operação de admin e passa pelo service_role.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER é obrigatório aqui: estas funções leem public.managers, que
-- também tem RLS. Sem isso, uma policy que chama a função entraria em recursão.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.managers m
    where m.id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

create or replace function public.manages_store(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.managers m
    where m.id = (select auth.uid())
      and (m.role = 'admin' or m.store_id = target)
  );
$$;

-- Loja visível no catálogo público. 'past_due' continua visível (carência);
-- 'suspended' some do site.
create or replace function public.store_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = target
      and s.is_active
      and s.subscription_status <> 'suspended'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.manages_store(uuid) from public;
revoke all on function public.store_is_public(uuid) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.manages_store(uuid) to anon, authenticated;
grant execute on function public.store_is_public(uuid) to anon, authenticated;
grant execute on function public.store_is_open(uuid, timestamptz) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Privilégios de tabela
--   O Supabase concede ALL por default a anon/authenticated. Revogamos tudo e
--   devolvemos só o necessário.
-- ----------------------------------------------------------------------------

revoke all on public.stores          from anon, authenticated;
revoke all on public.store_hours     from anon, authenticated;
revoke all on public.menu_categories from anon, authenticated;
revoke all on public.products        from anon, authenticated;
revoke all on public.option_groups   from anon, authenticated;
revoke all on public.options         from anon, authenticated;
revoke all on public.promotions      from anon, authenticated;
revoke all on public.managers        from anon, authenticated;
revoke all on public.events          from anon, authenticated;

-- Leitura do catálogo
grant select on public.stores          to anon, authenticated;
grant select on public.store_hours     to anon, authenticated;
grant select on public.menu_categories to anon, authenticated;
grant select on public.products        to anon, authenticated;
grant select on public.option_groups   to anon, authenticated;
grant select on public.options         to anon, authenticated;
grant select on public.promotions      to anon, authenticated;
grant select on public.managers        to authenticated;
grant select on public.events          to authenticated;

-- Escrita do gerente no próprio cardápio
grant insert, update, delete on public.store_hours     to authenticated;
grant insert, update, delete on public.menu_categories to authenticated;
grant insert, update, delete on public.products        to authenticated;
grant insert, update, delete on public.option_groups   to authenticated;
grant insert, update, delete on public.options         to authenticated;
grant insert, update, delete on public.promotions      to authenticated;

-- Escrita do gerente nos dados da loja: colunas explícitas.
-- is_active, subscription_status e subscription_until ficam de fora de propósito.
grant update (
  name, description, logo_url, cover_url, whatsapp_e164,
  address, city, neighborhood, lat, lng,
  cuisine_tags, kind, delivery_fee_cents, min_order_cents,
  is_open_manual
) on public.stores to authenticated;

-- events só é escrita pelo servidor (service_role), via /api/events.
-- Insert anônimo direto do browser deixaria qualquer um inflar as métricas que
-- justificam a mensalidade da loja.

-- ----------------------------------------------------------------------------
-- Habilitar RLS
-- ----------------------------------------------------------------------------

alter table public.stores          enable row level security;
alter table public.store_hours     enable row level security;
alter table public.menu_categories enable row level security;
alter table public.products        enable row level security;
alter table public.option_groups   enable row level security;
alter table public.options         enable row level security;
alter table public.promotions      enable row level security;
alter table public.managers        enable row level security;
alter table public.events          enable row level security;

-- ----------------------------------------------------------------------------
-- stores
-- ----------------------------------------------------------------------------

create policy stores_select_public on public.stores
  for select to anon, authenticated
  using (
    (is_active and subscription_status <> 'suspended')
    or public.manages_store(id)
  );

create policy stores_update_manager on public.stores
  for update to authenticated
  using (public.manages_store(id))
  with check (public.manages_store(id));

-- Sem policy de insert/delete: criar e remover loja é operação de admin,
-- feita pelo service_role no painel /admin.

-- ----------------------------------------------------------------------------
-- Tabelas do cardápio — mesmo par de regras
-- ----------------------------------------------------------------------------

create policy store_hours_select_public on public.store_hours
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy store_hours_write_manager on public.store_hours
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

create policy menu_categories_select_public on public.menu_categories
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy menu_categories_write_manager on public.menu_categories
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

create policy products_select_public on public.products
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy products_write_manager on public.products
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

create policy option_groups_select_public on public.option_groups
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy option_groups_write_manager on public.option_groups
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

create policy options_select_public on public.options
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy options_write_manager on public.options
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

create policy promotions_select_public on public.promotions
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy promotions_write_manager on public.promotions
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));

-- ----------------------------------------------------------------------------
-- managers — cada um enxerga só a própria linha; admin enxerga todas.
-- Criar gerente é operação de admin (service_role).
-- ----------------------------------------------------------------------------

create policy managers_select_self on public.managers
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- ----------------------------------------------------------------------------
-- events — o gerente lê os próprios números; ninguém escreve pelo browser.
-- ----------------------------------------------------------------------------

create policy events_select_manager on public.events
  for select to authenticated
  using (public.manages_store(store_id));
