-- =============================================================================
-- Petire — a fila de prospecção do bairro
--
-- `store_suggestions` já guarda a loja que um cliente pediu, e é a fila que o
-- produto produz sozinho depois que um bairro está no ar. Só que o **primeiro**
-- bairro não tem cliente para produzir sinal nenhum: ele é decidido a pé, com
-- o fundador andando na calçada e contando portas.
--
-- Esta tabela é esse levantamento — o bootstrap manual da mesma fila. Sem ela,
-- as duas horas de rua viram uma folha de papel que ninguém digita, e a ordem
-- da visita no dia seguinte volta a ser memória.
--
-- Ela é separada de `store_suggestions` de propósito. Aquela é um **sinal**,
-- escrito pelo servidor a partir de uma frustração de cliente e sem nada que
-- identifique quem indicou. Esta é **trabalho**: quem escreve é quem vende, e
-- ela carrega o estado da abordagem. Misturar as duas faria a fila de sinais
-- ganhar um campo de status que o cliente não tem como preencher.
-- =============================================================================

create type public.prospect_status as enum (
  'a_visitar',
  'visitada',
  'cadastrada',
  'recusou'
);

create table public.prospects (
  id     bigint generated always as identity primary key,
  -- Como está na fachada. É por esse nome que o fundador vai reconhecer a porta.
  name   text not null,

  city         text not null,
  neighborhood text not null,
  -- Geradas pelo banco, como em `stores`: é o que agrupa o levantamento com as
  -- lojas que já existem, e o app não tem como esquecer de atualizar.
  city_slug         text generated always as (public.slugify(city)) stored,
  neighborhood_slug text generated always as (public.slugify(neighborhood)) stored,

  -- ---------------------------------------------------------------------------
  -- As três colunas do levantamento
  --
  -- Não nulas com padrão falso, e não "não sei": quem preenche está parado na
  -- frente da loja. Se não há cardápio na vitrine, isso não é desconhecimento,
  -- é a resposta. O aplicativo se confere ali mesmo, no celular.
  -- ---------------------------------------------------------------------------
  has_menu     boolean not null default false,  -- cardápio visível na fachada
  has_whatsapp boolean not null default false,  -- WhatsApp na fachada
  on_app       boolean not null default false,  -- achei em aplicativo de delivery

  status public.prospect_status not null default 'a_visitar',
  note   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prospects_name_length check (length(name) between 2 and 80),
  constraint prospects_note_length check (note is null or length(note) <= 500)
);

-- A pergunta que a tela faz é sempre "quantas faltam neste bairro".
create index prospects_neighborhood_idx
  on public.prospects (city_slug, neighborhood_slug, status);

create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

comment on table public.prospects is
  'Levantamento de rua: lojas candidatas de um bairro e o estado da abordagem. Escrita e leitura só pelo admin.';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Mesma regra de `store_suggestions` e `demand_signals`: RLS ligada e nenhuma
-- policy, então só `service_role` entra — e `service_role` só é usado em
-- /admin. Leitura aberta entregaria a quem quisesse a lista das lojas que o
-- Petire está prestes a abordar, com o estado de cada conversa.
-- ----------------------------------------------------------------------------

revoke all on public.prospects from anon, authenticated;
revoke all on sequence public.prospects_id_seq from anon, authenticated;

alter table public.prospects enable row level security;
