-- =============================================================================
-- Petire — os sinais de demanda também têm prazo
--
-- `events` é podada aos 90 dias por `maintain_events`. `demand_signals` nunca
-- foi — e até semana passada isso era quase inofensivo, porque só a busca
-- **sem resultado** era registrada, que é a exceção. Desde
-- 20260920120000_busca_com_resultado.sql toda busca entra: o que era exceção
-- virou regra, e uma tabela que só cresce passou a crescer no ritmo do uso.
--
-- Noventa dias é folga dobrada sobre quem lê: a demanda do painel olha 30, e
-- o mapa de expansão do admin também.
--
-- Vai na mesma função, e não numa rotina nova, por um motivo prático: uma
-- tarefa agendada a mais é uma tarefa a mais para alguém descobrir que parou.
-- =============================================================================

create or replace function public.maintain_demand(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.demand_signals
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.maintain_demand(integer) is
  'Apaga sinal de demanda além da retenção. Sem soma antes: aqui o que interessa é a janela recente, não o histórico.';

-- Trabalho de manutenção: ninguém do browser executa isto.
revoke all on function public.maintain_demand(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Junto da poda de eventos, no mesmo horário
--
-- Substitui o agendamento existente em vez de criar outro: `cron.schedule` com
-- o mesmo nome sobrescreve, e o comando passa a fazer as duas coisas.
-- ----------------------------------------------------------------------------

select cron.schedule(
  'petire-manter-events',
  '17 4 * * *',
  $cron$ select public.maintain_events(); select public.maintain_demand(); $cron$
);
