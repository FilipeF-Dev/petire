-- =============================================================================
-- Petire — autocadastro com fila de aprovação
--
-- Cadastrar loja é hoje trabalho do admin: ele pede os dados por WhatsApp,
-- digita tudo e devolve a senha. Isso funciona nas dez primeiras lojas e vira o
-- gargalo do go-to-market a partir de umas trinta — e é trabalho do fundador,
-- não do produto.
--
-- O que muda é quem digita, não quem aprova. O lojista preenche os próprios
-- dados; o admin revisa e libera. Duas coisas continuam de fora do alcance do
-- formulário público, de propósito:
--
--   a conta de acesso — criar usuário de auth por formulário aberto é convite
--   a robô, e a senha inicial precisa chegar a uma pessoa de verdade;
--
--   a loja no ar — ela nasce fora do ar de qualquer jeito (loja sem cardápio é
--   pior do que loja nenhuma), e quem confere o cardápio é o admin.
--
-- Por isso a candidatura é uma tabela à parte, e não uma loja com um status a
-- mais: uma linha aqui não é uma loja, é um pedido para virar uma.
-- =============================================================================

create type public.application_status as enum (
  'pending',   -- na fila do admin
  'approved',  -- virou loja; store_id aponta para ela
  'rejected'
);

create table public.store_applications (
  id                bigint generated always as identity primary key,
  store_name        text not null,
  manager_email     text not null,
  whatsapp_e164     text not null,
  cep               text,
  address           text,
  city              text not null,
  neighborhood      text not null,
  state_uf          text,
  ibge_code         text,
  kind              public.store_kind not null,
  -- O que o lojista quis contar. Costuma ser o horário, o tipo de comida ou
  -- "posso mandar o cardápio por foto?".
  note              text,
  status            public.application_status not null default 'pending',
  -- Preenchido na aprovação. Liga o pedido à loja que ele virou.
  store_id          uuid references public.stores(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),

  constraint store_applications_name_length
    check (length(btrim(store_name)) between 2 and 80),
  constraint store_applications_email_format
    check (manager_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Mesma regra de stores.whatsapp_e164: só dígitos, com código do país. O
  -- número errado é o defeito mais caro do Petire.
  constraint store_applications_whatsapp_format
    check (whatsapp_e164 ~ '^[0-9]{10,15}$'),
  constraint store_applications_cep_format
    check (cep is null or cep ~ '^[0-9]{8}$'),
  constraint store_applications_uf_format
    check (state_uf is null or state_uf ~ '^[A-Z]{2}$'),
  constraint store_applications_ibge_format
    check (ibge_code is null or ibge_code ~ '^[0-9]{7}$'),
  constraint store_applications_note_length
    check (note is null or length(note) <= 500)
);

create index store_applications_status_created_idx
  on public.store_applications (status, created_at desc);

-- Enviar duas vezes é o comportamento normal de quem não recebeu resposta em
-- um dia. Duas linhas na fila fariam o admin criar duas lojas para a mesma
-- pessoa — e a segunda esbarraria no e-mail já cadastrado, depois de já ter
-- criado a loja órfã.
create unique index store_applications_one_pending_per_email
  on public.store_applications (lower(manager_email))
  where status = 'pending';

comment on table public.store_applications is
  'Fila de lojas que se candidataram sozinhas. Uma linha aqui não é uma loja: é um pedido para virar uma.';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Mesma regra de `demand_signals` e `store_suggestions`: só o servidor escreve,
-- só o admin lê. A fila carrega e-mail e telefone de quem se candidatou —
-- deixá-la legível pelo browser entregaria a lista de lojas prestes a entrar
-- para qualquer concorrente.
-- ----------------------------------------------------------------------------

revoke all on public.store_applications from anon, authenticated;

alter table public.store_applications enable row level security;
