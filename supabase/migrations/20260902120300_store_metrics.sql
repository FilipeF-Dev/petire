-- =============================================================================
-- Petire — métricas da loja
--
-- Uma chamada em vez de três COUNTs, e a janela de tempo é calculada com o
-- relógio do banco. O relógio do servidor de render não tem nada a ver com
-- quando os eventos foram gravados.
--
-- SECURITY INVOKER de propósito: o RLS de public.events continua valendo, então
-- um gerente que passar o id da loja vizinha recebe zeros.
-- =============================================================================

create or replace function public.store_metrics(
  target uuid,
  window_days integer default 30
)
returns table (
  store_views     bigint,
  cart_adds       bigint,
  whatsapp_clicks bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where e.kind = 'store_view'),
    count(*) filter (where e.kind = 'cart_add'),
    count(*) filter (where e.kind = 'whatsapp_click')
  from public.events e
  where e.store_id = target
    and e.created_at >= now() - make_interval(days => window_days);
$$;

revoke all on function public.store_metrics(uuid, integer) from public;
grant execute on function public.store_metrics(uuid, integer) to authenticated;
