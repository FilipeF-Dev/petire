-- =============================================================================
-- Petire — histórico de pagamento da mensalidade
--
-- A cobrança é PIX conferido a mão, e o trabalho cresce em linha reta com o
-- número de lojas: conferir o comprovante, lembrar até quando aquilo paga,
-- anotar o vencimento novo em algum lugar. Hoje esse "algum lugar" é a data em
-- `stores.subscription_until`, que o próximo pagamento sobrescreve — então não
-- existe resposta para "quando ele pagou da última vez?" nem para "ele já
-- pagou este mês?".
--
-- Esta tabela é esse registro. A data de vencimento continua em `stores`
-- porque é ela que a vitrine consulta; aqui fica como se chegou até ela.
--
-- Não é sistema financeiro: não emite nota, não concilia, não cobra. É o
-- caderninho que hoje está na cabeça do fundador — e é o que permite chegar na
-- conversa de renovação sabendo o histórico.
-- =============================================================================

create table public.subscription_payments (
  id           bigint generated always as identity primary key,
  store_id     uuid not null references public.stores(id) on delete cascade,
  amount_cents integer not null,
  -- Quando o dinheiro caiu. Pode ser retroativo: o admin registra depois.
  paid_on      date not null default current_date,
  -- Até quando este pagamento cobre. É o valor que vai para
  -- `stores.subscription_until` na mesma operação.
  covers_until date not null,
  note         text,
  created_at   timestamptz not null default now(),

  constraint subscription_payments_amount_positive check (amount_cents > 0),
  constraint subscription_payments_note_length check (note is null or length(note) <= 200)
);

create index subscription_payments_store_paid_idx
  on public.subscription_payments (store_id, paid_on desc);

comment on table public.subscription_payments is
  'Pagamentos da mensalidade, registrados a mão pelo admin. stores.subscription_until é o resultado; isto é o histórico.';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Escrita só pelo admin, que já usa service_role — assinatura nunca foi
-- editável pelo lojista, e isso é privilégio de coluna em `stores`, não uma
-- policy que se possa esquecer.
--
-- Leitura o gerente tem, da própria loja: "quando eu paguei?" é a pergunta que
-- ele faz por WhatsApp, e respondê-la no painel é uma conversa a menos que a
-- mensalidade de R$30 não paga.
-- ----------------------------------------------------------------------------

revoke all on public.subscription_payments from anon, authenticated;
grant select on public.subscription_payments to authenticated;

alter table public.subscription_payments enable row level security;

create policy subscription_payments_select_manager on public.subscription_payments
  for select to authenticated
  using (public.manages_store(store_id));
