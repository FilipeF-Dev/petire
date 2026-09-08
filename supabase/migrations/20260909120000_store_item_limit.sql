-- =============================================================================
-- Petire — quantos itens o cardápio pode ter
--
-- Segundo recurso a virar degrau de plano, depois dos logins de equipe. Vale a
-- mesma regra dos outros: o degrau é por **recurso**, nunca por volume de
-- pedido — cobrar mais de quem vende mais seria comissão com outro nome.
--
-- Os números são o botão comercial e moram só aqui. Trocar o teto de um plano é
-- editar esta função, sem tocar em app nem em migration de tabela.
--
-- O padrão que escolhi tem uma consequência de negócio que vale dizer em voz
-- alta: 100 itens cobrem qualquer lanchonete com folga, mas uma distribuidora
-- de bebidas tem centenas de rótulos. Na prática, isto põe a distribuidora no
-- plano de cima. É uma decisão defensável — ela também é quem mais usa o
-- catálogo — mas é uma decisão, não um efeito colateral.
-- =============================================================================

create or replace function public.store_item_limit(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case (select plan from public.stores where id = target)
    when 'plus' then 1000
    else 100
  end;
$$;

comment on function public.store_item_limit(uuid) is
  'Quantos itens o cardápio da loja pode ter, pelo plano dela. Os números são o botão comercial.';

revoke all on function public.store_item_limit(uuid) from public;
grant execute on function public.store_item_limit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Quem garante é o banco
--
-- AFTER ... FOR EACH STATEMENT, e não BEFORE ... FOR EACH ROW, por causa da
-- importação de cardápio: ela insere dezenas de linhas num comando só, e um
-- gatilho por linha não enxerga as linhas anteriores do mesmo comando — o
-- cardápio colado passaria direto pelo teto.
--
-- Com a tabela de transição, o mesmo gatilho cobre o item criado a mão e o
-- cardápio inteiro colado de uma vez, e só conta as lojas que o comando tocou.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
-- DEFINER para a contagem ser a real, e não a que o RLS de quem inseriu
-- consegue enxergar.
security definer
set search_path = ''
as $$
declare
  entry record;
begin
  for entry in
    select
      p.store_id,
      count(*) as used,
      public.store_item_limit(p.store_id) as allowed
    from public.products p
    where p.store_id in (select distinct store_id from new_rows)
    group by p.store_id
  loop
    if entry.used > entry.allowed then
      -- A mensagem é escrita para o lojista ler: ela chega à tela como está.
      raise exception
        'Seu plano permite % itens no cardápio, e este item passaria disso.',
        entry.allowed
        using errcode = 'PT422';
    end if;
  end loop;

  return null;
end;
$$;

create trigger products_respect_item_limit
  after insert on public.products
  referencing new table as new_rows
  for each statement execute function public.enforce_item_limit();

comment on function public.enforce_item_limit() is
  'Recusa o insert que passa do teto do plano. PT422 pede ao PostgREST o status 422 e é o código que o app traduz na tela.';
