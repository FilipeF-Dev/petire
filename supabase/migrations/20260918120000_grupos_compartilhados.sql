-- =============================================================================
-- Petire — o grupo de opções passa a ser da loja, não do item
--
-- "Trocar o bife por picanha" vale para os doze hambúrgueres da casa. Como o
-- grupo nascia preso a um produto, eram doze grupos e doze listas de opções
-- iguais — e no dia em que a picanha mudasse de preço, doze edições, com a
-- certeza de esquecer uma. O mesmo vale para "Tamanho" nas porções e nas
-- bebidas.
--
-- Agora o grupo é um objeto da loja e uma tabela de ligação diz em quais itens
-- ele aparece, e em que ordem dentro de cada um. Editar o grupo muda em todos
-- de uma vez, que é justamente o que se quer dele.
--
-- **O preço da opção é o mesmo em todo item que usa o grupo.** É decisão de
-- produto, não limitação: quem precisar cobrar a picanha mais cara no duplo
-- cria um segundo grupo. Preço por ligação faria a mesma opção custar coisas
-- diferentes em telas iguais, e ninguém auditaria isso pelo painel.
-- =============================================================================

create table public.product_option_groups (
  store_id   uuid not null,
  product_id uuid not null,
  group_id   uuid not null,
  -- A ordem é da ligação, e não do grupo: "Tamanho" pode vir antes dos
  -- adicionais numa pizza e depois deles num açaí.
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  primary key (product_id, group_id),

  -- `store_id` viaja nas duas chaves pelo mesmo motivo das outras tabelas do
  -- cardápio: é o que impede ligar o grupo de uma loja ao item de outra.
  constraint product_option_groups_product_same_store
    foreign key (product_id, store_id)
    references public.products (id, store_id) on delete cascade,
  constraint product_option_groups_group_same_store
    foreign key (group_id, store_id)
    references public.option_groups (id, store_id) on delete cascade
);

-- Para responder "quais itens usam este grupo?", que é a pergunta antes de
-- editar e antes de apagar.
create index product_option_groups_group_idx
  on public.product_option_groups (group_id);

comment on table public.product_option_groups is
  'Em quais itens cada grupo de opções aparece, e em que ordem dentro do item.';

-- ----------------------------------------------------------------------------
-- O que já existe vira ligação, sem ninguém perder nada
-- ----------------------------------------------------------------------------

insert into public.product_option_groups (store_id, product_id, group_id, sort_order)
select g.store_id, g.product_id, g.id, g.sort_order
from public.option_groups g;

-- As duas colunas antigas **continuam existindo**, e isso é deliberado.
--
-- Esta migration é aplicada antes de o código novo subir, para que o banco
-- esteja pronto quando ele chegar. Nessa janela quem está no ar é o código
-- antigo, que ainda lê `sort_order` e filtra por `product_id` — derrubar as
-- colunas aqui deixaria a vitrine sem cardápio até o deploy terminar. É a
-- regra que o README já enuncia: o que sai de uso vira duas entregas, primeiro
-- o código para de usar, depois a coluna sai.
--
-- O que muda é só a obrigatoriedade: o código novo cria grupo sem produto
-- nenhum, e um NOT NULL sem valor a oferecer barraria a criação.
alter table public.option_groups alter column product_id drop not null;
alter table public.option_groups alter column sort_order drop not null;

comment on column public.option_groups.product_id is
  'Herança do tempo em que o grupo era do item. Sai numa migration própria, depois que o código novo estiver no ar. Ver product_option_groups.';
comment on column public.option_groups.sort_order is
  'Herança: a ordem agora é da ligação, em product_option_groups.';

-- ----------------------------------------------------------------------------
-- Acesso — as mesmas regras das outras tabelas do cardápio
-- ----------------------------------------------------------------------------

revoke all on public.product_option_groups from anon, authenticated;
grant select on public.product_option_groups to anon, authenticated;
grant insert, update, delete on public.product_option_groups to authenticated;

alter table public.product_option_groups enable row level security;

create policy product_option_groups_select_public on public.product_option_groups
  for select to anon, authenticated
  using (public.store_is_public(store_id) or public.manages_store(store_id));

create policy product_option_groups_write_manager on public.product_option_groups
  for all to authenticated
  using (public.manages_store(store_id))
  with check (public.manages_store(store_id));
