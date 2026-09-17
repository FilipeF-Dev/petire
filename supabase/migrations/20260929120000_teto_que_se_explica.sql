-- =============================================================================
-- Petire — a mensagem do teto dizendo a conta
--
-- Relato real: o suporte colou um cardápio de 88 itens e recebeu "Seu plano
-- permite 100 itens no cardápio, e este item passaria disso". A conta estava
-- certa — a loja já tinha itens de uma colagem anterior —, mas a mensagem não
-- dava como saber disso. Quem colou 88 num teto de 100 lê aquilo e conclui que
-- o sistema errou.
--
-- Dois problemas no texto antigo, e os dois vêm de ele ter sido escrito
-- pensando no item criado a mão:
--
--   "este item"  — numa importação não é um item, são dezenas.
--   sem números  — não diz quantos a loja já tem, que é a informação que
--                  falta para a frase fazer sentido.
--
-- A nova diz a conta inteira. Ela chega à tela como está, então é escrita para
-- o lojista ler, não para o log.
-- =============================================================================

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
  entrando integer;
  antes integer;
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
      select count(*) into entrando
        from new_rows n
       where n.store_id = entry.store_id;

      antes := entry.used - entrando;

      raise exception
        'Seu plano permite % itens no cardápio. A loja já tem %, e isto traria mais % — daria %.',
        entry.allowed, antes, entrando, entry.used
        using errcode = 'PT422';
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.enforce_item_limit() is
  'Recusa o insert que passa do teto do plano, dizendo a conta: quantos a loja já tem, quantos entrariam e qual o teto. PT422 pede ao PostgREST o status 422 e é o código que o app traduz na tela.';
