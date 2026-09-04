-- =============================================================================
-- Petire — degraus de plano
--
-- A loja com 400 pedidos paga o mesmo que a com 4. Isso é ótimo para vender —
-- é literalmente o argumento contra o iFood — e não pode mudar: comissão zero
-- é a razão de a loja estar aqui.
--
-- Então o degrau é por **recurso**, nunca por volume de pedido. O que o plano
-- pago abre não custa mais caro conforme a loja vende mais, e nada aqui toca a
-- vitrine: o cliente não vê plano nenhum, e a ordem da lista continua sendo por
-- distância. Vender posição gastaria a confiança que traz o cliente de volta.
--
-- Fica fora de `stores_public` de propósito, e fora do `GRANT UPDATE` do
-- gerente pelo mesmo motivo de `subscription_status`: quem muda o plano é quem
-- cobra por ele.
-- =============================================================================

create type public.store_plan as enum (
  'basico',  -- o que sempre existiu: um login, o painel inteiro
  'plus'     -- equipe com mais de um login e relatório mensal
);

alter table public.stores
  add column plan public.store_plan not null default 'basico';

comment on column public.stores.plan is
  'Degrau de recurso. Nunca depende de volume de pedidos. Invisível para o cliente.';

-- O lojista precisa saber em que plano está, para o painel dizer o que está
-- aberto e o que não está. Ler, sim; escrever, não.
grant select (plan) on public.stores to authenticated;

-- ----------------------------------------------------------------------------
-- Quantos logins o plano permite
--
-- No banco e não no app: é o app que decide o que mostrar, mas é aqui que a
-- regra não tem como ser contornada por uma tela nova que alguém escreva
-- amanhã.
-- ----------------------------------------------------------------------------

create or replace function public.store_manager_limit(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case (select plan from public.stores where id = target)
    when 'plus' then 5
    else 1
  end;
$$;

comment on function public.store_manager_limit(uuid) is
  'Quantos logins de gerente a loja pode ter, pelo plano dela.';

revoke all on function public.store_manager_limit(uuid) from public;
grant execute on function public.store_manager_limit(uuid) to authenticated;
