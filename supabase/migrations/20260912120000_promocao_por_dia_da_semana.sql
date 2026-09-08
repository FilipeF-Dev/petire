-- =============================================================================
-- Petire — promoção que se repete no dia da semana
--
-- Terceiro degrau de plano, depois dos logins de equipe e do teto de itens.
-- Vale a mesma regra dos outros: o degrau é por **recurso**, nunca por volume
-- de pedido — cobrar mais de quem vende mais seria comissão com outro nome.
--
-- A dor já estava escrita no próprio código, no comentário de
-- `setPromotionActive`: "refazer a mesma janela toda sexta é o tipo de trabalho
-- que o lojista abandona". Até aqui a saída era pausar e retomar na mão, toda
-- semana, e quem esquece de retomar perde a promoção — quem esquece de pausar
-- dá desconto na segunda-feira.
--
-- **Dia da semana, e não faixa de horário.** /loja/[slug] é estática com
-- revalidate de uma hora, e o preço é resolvido no render: ele fica assado no
-- HTML por até 60 minutos, enquanto o carrinho relê do banco na hora. Numa
-- janela por dia esse desencontro cai na virada da meia-noite e não machuca
-- ninguém. Numa janela por hora ele cairia às 18h e às 22h — o cardápio
-- mostrando um preço e o carrinho cobrando outro, no horário de pico. Happy
-- hour por hora exige resolver a revalidação antes, e é outra entrega.
-- =============================================================================

alter table public.promotions
  add column weekdays smallint[];

comment on column public.promotions.weekdays is
  'Dias da semana em que a promoção vale, 0 = domingo, igual a store_hours.weekday e a extract(dow). Nulo = todos os dias.';

-- Nulo é "todos os dias", e é diferente de array vazio, que não quer dizer
-- nada: uma promoção que não vale em dia nenhum é um registro que só confunde
-- quem for ler o painel depois.
alter table public.promotions
  add constraint promotions_weekdays_valid
  check (
    weekdays is null
    or (
      array_length(weekdays, 1) between 1 and 7
      and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  );

-- ----------------------------------------------------------------------------
-- O degrau
--
-- No banco e não no app, como o limite de logins e o de itens: é o app que
-- decide o que mostrar, mas é aqui que a regra não tem como ser contornada por
-- uma tela nova que alguém escreva amanhã.
-- ----------------------------------------------------------------------------

create or replace function public.store_schedules_promotions(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select plan from public.stores where id = target) = 'plus';
$$;

comment on function public.store_schedules_promotions(uuid) is
  'Se o plano da loja abre a promoção que se repete por dia da semana.';

revoke all on function public.store_schedules_promotions(uuid) from public;
grant execute on function public.store_schedules_promotions(uuid) to authenticated;

create or replace function public.enforce_promotion_schedule_plan()
returns trigger
language plpgsql
-- DEFINER para ler `stores.plan`, que o gerente enxerga mas cujo GRANT não é
-- o caminho de que este gatilho depende.
security definer
set search_path = ''
as $$
begin
  -- Só quando os dias mudam. Uma loja que caiu para o básico continua com as
  -- promoções que já tinha, e pausar ou apagar uma delas não pode falhar por
  -- causa de um plano que mudou depois — é a mesma escolha do teto de itens,
  -- que só vale na entrada.
  if tg_op = 'UPDATE' and new.weekdays is not distinct from old.weekdays then
    return new;
  end if;

  if new.weekdays is not null
     and not public.store_schedules_promotions(new.store_id) then
    -- PT422, e não um SQLSTATE qualquer: o PostgREST transforma PTxyz no
    -- status HTTP xyz, e a mensagem chega à tela como está escrita aqui.
    raise exception
      'Repetir a promoção por dia da semana é do plano Plus.'
      using errcode = 'PT422';
  end if;

  return new;
end;
$$;

comment on function public.enforce_promotion_schedule_plan() is
  'Recusa dias da semana em loja fora do Plus. PT422 é o código que o app traduz na tela.';

create trigger promotions_respect_schedule_plan
  before insert or update on public.promotions
  for each row execute function public.enforce_promotion_schedule_plan();
