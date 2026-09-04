-- =============================================================================
-- Petire — a loja que o cliente queria encontrar
--
-- `demand_signals` já diz *que* alguém procurou e não achou. Não diz o que
-- fazer a respeito: "cidade tal, 12 buscas" ainda deixa a pergunta de qual
-- porta bater.
--
-- Quem sabe responder isso é a pessoa que acabou de não encontrar nada. Ela
-- tem uma lanchonete favorita, sabe o nome e provavelmente segue no Instagram.
-- Perguntar ali, no lugar exato da frustração, transforma o beco sem saída na
-- fila de prospecção — e a abordagem deixa de ser fria: "um cliente seu pediu
-- que a gente falasse com você".
--
-- Privacidade: o que se guarda é o contato **da loja**, público por natureza,
-- dado voluntariamente por quem sugeriu. Nada identifica quem sugeriu — sem
-- nome, sem telefone de cliente, sem CEP. O lugar entra como slug, igual ao
-- resto.
-- =============================================================================

create table public.store_suggestions (
  id                bigint generated always as identity primary key,
  -- Nome da loja como o cliente conhece. É o que vai virar a busca no
  -- Instagram ou a pergunta no bairro.
  store_name        text not null,
  -- Como falar com ela: @ do Instagram, telefone, o que a pessoa souber.
  -- Opcional — quem não sabe o contato ainda contribuiu com o nome.
  contact           text,
  city_slug         text,
  neighborhood_slug text,
  created_at        timestamptz not null default now(),

  constraint store_suggestions_name_length
    check (length(store_name) between 2 and 80),
  constraint store_suggestions_contact_length
    check (contact is null or length(contact) <= 80)
);

create index store_suggestions_created_idx
  on public.store_suggestions (created_at desc);

comment on table public.store_suggestions is
  'Lojas indicadas por clientes que não acharam nada. Fila de prospecção. Sem dado de quem indicou.';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Mesma regra de `demand_signals`: só o servidor escreve, e só o admin lê. Se o
-- browser escrevesse direto, a fila de prospecção viraria caixa de spam; se
-- lesse, seria a lista de quem o Petire está prestes a abordar, aberta a
-- qualquer um.
-- ----------------------------------------------------------------------------

revoke all on public.store_suggestions from anon, authenticated;

alter table public.store_suggestions enable row level security;
