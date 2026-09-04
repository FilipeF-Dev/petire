-- =============================================================================
-- Petire — sinais de demanda não atendida
--
-- Quem procura "pizza" e não encontra nada, e quem informa o CEP de uma cidade
-- sem loja, são hoje becos sem saída silenciosos. São também o dado mais
-- valioso que o produto sabe produzir: dizem onde abrir o próximo bairro e
-- qual loja convidar primeiro. O plano é um bairro por vez, e até aqui a
-- escolha de qual bairro era palpite.
--
-- Por que uma tabela separada de `events`:
--
--   `events` é a prova de valor de **uma loja** — é o número que ela vê no
--   painel e que sustenta a renovação. Por isso `store_id` é NOT NULL ali, e
--   por isso o índice é por loja. Sinal de demanda não tem loja nenhuma (é o
--   contrário: existe porque não havia loja) e quem lê é o Petire, não o
--   lojista. Misturar os dois contaminaria a métrica que vira dinheiro.
--
-- Privacidade: aqui entra só o slug da cidade e do bairro, nunca o CEP que o
-- cliente digitou. O CEP não sai do aparelho dele — ver
-- src/lib/customer-location.ts — e não é este recurso que vai começar a
-- guardá-lo. Sem identidade, sem sessão, sem IP: o que se acumula é um mapa de
-- lugares e termos, não um histórico de pessoas.
-- =============================================================================

create type public.demand_kind as enum (
  'search_empty',   -- busca por item ou loja que não devolveu nada
  'area_uncovered'  -- cidade/bairro sem nenhuma loja no ar
);

create table public.demand_signals (
  id                bigint generated always as identity primary key,
  kind              public.demand_kind not null,
  -- Slugs, gêmeos dos de `stores`: é o que permite cruzar o sinal com o
  -- catálogo sem depender de grafia.
  city_slug         text,
  neighborhood_slug text,
  -- O que a pessoa procurava. Nulo em 'area_uncovered', que não tem termo.
  term              text,
  created_at        timestamptz not null default now(),

  constraint demand_signals_term_length check (term is null or length(term) <= 80),
  -- Sinal sem lugar nem termo não diz nada e só ocuparia espaço.
  constraint demand_signals_has_content check (
    city_slug is not null or term is not null
  )
);

create index demand_signals_kind_created_idx
  on public.demand_signals (kind, created_at desc);

create index demand_signals_city_created_idx
  on public.demand_signals (city_slug, created_at desc);

comment on table public.demand_signals is
  'Demanda que o catálogo não atendeu. Alimenta a decisão de onde expandir. Sem dado pessoal: só slug de lugar e termo buscado.';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Mesma regra de `events`, pelo mesmo motivo: escrita só pelo servidor, com
-- service_role, via /api/demanda. Insert direto do browser deixaria qualquer um
-- fabricar demanda para um bairro — e é justamente por este número que o
-- próximo bairro vai ser escolhido.
--
-- Leitura é do admin, que já usa service_role e ignora RLS. Nenhuma policy:
-- com RLS ligada e sem policy, anon e authenticated não enxergam nada.
-- ----------------------------------------------------------------------------

revoke all on public.demand_signals from anon, authenticated;

alter table public.demand_signals enable row level security;

-- ----------------------------------------------------------------------------
-- demand_summary — o que somar antes de escolher o próximo bairro
--
-- A soma sai daqui e não do render, pelo mesmo motivo de `store_metrics`: a
-- janela é contada com o relógio do banco, que é o que gravou as linhas. O
-- relógio do servidor da Vercel não tem nada a ver com elas.
--
-- Um rótulo só, seja termo ou cidade: quem lê quer as duas listas lado a lado,
-- e um `case` aqui evita duas consultas e duas ordenações no app.
-- ----------------------------------------------------------------------------

create or replace function public.demand_summary(
  window_days integer default 30
)
returns table (
  kind  public.demand_kind,
  label text,
  hits  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.kind,
    case when d.kind = 'search_empty' then d.term else d.city_slug end,
    count(*)
  from public.demand_signals d
  where d.created_at >= now() - make_interval(days => window_days)
    and case when d.kind = 'search_empty' then d.term else d.city_slug end is not null
  group by 1, 2
  order by 3 desc, 2;
$$;

-- Só o admin lê, e ele já usa service_role — a mesma chave que /api/demand usa
-- para escrever. Nenhum papel do browser recebe execute.
revoke all on function public.demand_summary(integer) from public, anon, authenticated;
grant execute on function public.demand_summary(integer) to service_role;
