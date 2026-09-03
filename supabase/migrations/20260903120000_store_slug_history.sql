-- =============================================================================
-- Petire — histórico de apelidos de loja
--
-- O admin passa a poder editar o apelido (slug) de uma loja já cadastrada.
-- Sem rede de proteção isso é uma armadilha: o slug é a URL pública, é o que
-- o Google indexou e é o link que o cliente salvou no WhatsApp. Trocar sem
-- mais nada transforma tudo isso em 404 silencioso.
--
-- Com o histórico, o apelido antigo continua respondendo — a página pública
-- redireciona de forma permanente para o novo.
-- =============================================================================

create table public.store_slug_history (
  slug       text primary key,
  store_id   uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint store_slug_history_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index store_slug_history_store_idx
  on public.store_slug_history (store_id);

comment on table public.store_slug_history is
  'Apelidos que uma loja já teve. Alimenta o redirecionamento em /loja/[slug].';

-- O redirecionamento acontece na página pública, então o visitante precisa
-- conseguir ler. É só um mapa de apelido para loja: não revela nada que a
-- própria página da loja já não mostre.
revoke all on public.store_slug_history from anon, authenticated;
grant select on public.store_slug_history to anon, authenticated;

alter table public.store_slug_history enable row level security;

create policy store_slug_history_select_public on public.store_slug_history
  for select to anon, authenticated
  using (true);

-- Escrita só por service_role: trocar apelido é operação de admin.
