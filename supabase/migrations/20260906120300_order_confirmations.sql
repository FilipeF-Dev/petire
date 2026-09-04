-- =============================================================================
-- Petire — quantos pedidos realmente chegaram
--
-- `whatsapp_click` mede intenção, não pedido: ele é gravado quando o cliente
-- sai para o WhatsApp, e daqui ninguém vê se ele apertou enviar. O painel já
-- diz isso no rótulo ("pedidos abertos no WhatsApp"), o que resolve a
-- honestidade e não resolve a pergunta — porque na conversa de renovação o
-- lojista responde "mas eu não recebi 84".
--
-- Quem sabe a resposta é ele. Uma vez por semana, o painel pergunta quantos
-- chegaram, e a razão entre as duas contagens vira a taxa que falta. Com ela,
-- "saíram 84 daqui" deixa de ser uma alegação e vira uma conta que o próprio
-- lojista conferiu.
--
-- Semana fechada e não mês: um mês depois ninguém lembra. E é a única coisa
-- que o gerente escreve sobre as próprias métricas, então `opened` **não** vem
-- do formulário — vem de um trigger que conta os eventos de verdade. Ele
-- informa o numerador; o denominador é do sistema.
-- =============================================================================

create table public.order_confirmations (
  id         bigint generated always as identity primary key,
  store_id   uuid not null references public.stores(id) on delete cascade,
  -- Segunda-feira da semana confirmada, no fuso de Brasília.
  week_start date not null,
  -- Cliques medidos naquela semana. Preenchido pelo trigger, nunca pelo form.
  opened     integer not null default 0,
  -- O que a loja diz ter recebido.
  confirmed  integer not null,
  created_at timestamptz not null default now(),

  constraint order_confirmations_week_is_monday
    check (extract(isodow from week_start) = 1),
  -- Teto generoso: existe para barrar dedo escorregado, não para duvidar da
  -- loja.
  constraint order_confirmations_confirmed_range
    check (confirmed between 0 and 10000),
  constraint order_confirmations_one_per_week
    unique (store_id, week_start)
);

comment on table public.order_confirmations is
  'Quantos pedidos a loja diz ter recebido numa semana, contra quantos saíram daqui. Calibra a conversa de renovação.';

-- ----------------------------------------------------------------------------
-- O denominador é do sistema
-- ----------------------------------------------------------------------------

create or replace function public.fill_confirmation_opened()
returns trigger
language plpgsql
-- DEFINER para a contagem ser a real, e não a que o RLS de quem inseriu
-- consegue enxergar.
security definer
set search_path = ''
as $$
begin
  new.opened := (
    select count(*)
    from public.events e
    where e.store_id = new.store_id
      and e.kind = 'whatsapp_click'
      and (e.created_at at time zone 'America/Sao_Paulo')::date
            between new.week_start and new.week_start + 6
  );
  return new;
end;
$$;

create trigger order_confirmations_fill_opened
  before insert on public.order_confirmations
  for each row execute function public.fill_confirmation_opened();

-- ----------------------------------------------------------------------------
-- A semana que ainda falta confirmar
--
-- A última semana **fechada**: perguntar sobre a semana em curso pediria um
-- número que ainda vai mudar. Devolve nada quando já foi respondida ou quando
-- não saiu pedido nenhum — nesse caso não há o que calibrar, e a pergunta só
-- lembraria o lojista de que a semana foi fraca.
-- ----------------------------------------------------------------------------

create or replace function public.store_pending_confirmation(target uuid)
returns table (
  week_start date,
  week_end   date,
  opened     bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with w as (
    select (
      date_trunc('week', (now() at time zone 'America/Sao_Paulo')) - interval '7 days'
    )::date as start
  )
  select
    w.start,
    (w.start + 6)::date,
    (
      select count(*)
      from public.events e
      where e.store_id = target
        and e.kind = 'whatsapp_click'
        and (e.created_at at time zone 'America/Sao_Paulo')::date
              between w.start and w.start + 6
    )
  from w
  where not exists (
    select 1
    from public.order_confirmations c
    where c.store_id = target
      and c.week_start = w.start
  );
$$;

revoke all on function public.store_pending_confirmation(uuid) from public;
grant execute on function public.store_pending_confirmation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Acesso
--
-- O gerente lê e escreve a da própria loja, e só isso: confirmação não se
-- edita nem se apaga. Se pudesse, deixaria de ser um registro do que aconteceu
-- e viraria um número ajustável depois de conhecido o resultado.
--
-- `opened` fica fora do INSERT: o trigger o preenche, e o privilégio de coluna
-- diz por escrito que aquele número não é do formulário.
-- ----------------------------------------------------------------------------

revoke all on public.order_confirmations from anon, authenticated;
grant select on public.order_confirmations to authenticated;
grant insert (store_id, week_start, confirmed) on public.order_confirmations to authenticated;

alter table public.order_confirmations enable row level security;

create policy order_confirmations_select_manager on public.order_confirmations
  for select to authenticated
  using (public.manages_store(store_id));

create policy order_confirmations_insert_manager on public.order_confirmations
  for insert to authenticated
  with check (public.manages_store(store_id));
