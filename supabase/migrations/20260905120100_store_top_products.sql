-- =============================================================================
-- Petire — o que mais entra no carrinho
--
-- O painel mostrava três números soltos de 30 dias. Número solto não é
-- acionável: o lojista lê "18 pedidos" e não sabe o que fazer com isso.
--
-- O que ele sabe fazer é mexer no cardápio — subir um item, dar desconto nele,
-- garantir que não falte. Para isso ele precisa saber qual item puxa o pedido,
-- e `cart_add` já grava o produto desde o começo. O dado estava lá e ninguém
-- mostrava.
--
-- `cart_add` e não `whatsapp_click` porque só o primeiro tem produto: o clique
-- é do carrinho inteiro, e o carrinho pode ter dez itens.
--
-- SECURITY INVOKER, como `store_metrics`: o RLS de `events` continua valendo, e
-- um gerente que passar o id da loja vizinha recebe lista vazia.
-- =============================================================================

create or replace function public.store_top_products(
  target uuid,
  window_days integer default 30,
  max_rows integer default 5
)
returns table (
  product_id uuid,
  name       text,
  adds       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.product_id, p.name, count(*)
  from public.events e
  join public.products p on p.id = e.product_id
  where e.store_id = target
    and e.kind = 'cart_add'
    and e.created_at >= now() - make_interval(days => window_days)
  group by e.product_id, p.name
  order by count(*) desc, p.name
  limit max_rows;
$$;

comment on function public.store_top_products(uuid, integer, integer) is
  'Itens mais adicionados ao carrinho na janela. Produto apagado some junto, pelo join.';

revoke all on function public.store_top_products(uuid, integer, integer) from public;
grant execute on function public.store_top_products(uuid, integer, integer) to authenticated;
