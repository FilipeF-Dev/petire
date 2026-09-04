-- =============================================================================
-- Petire — o gerente enxerga a própria equipe
--
-- `managers_select_self` deixava cada um ver só a própria linha, o que estava
-- certo enquanto era um login por loja: não havia equipe para enxergar.
--
-- Com mais de um acesso, essa policy quebra duas coisas de uma vez — a tela de
-- equipe lista só quem está olhando, e a remoção falha, porque a action confere
-- que o alvo é da mesma loja antes de apagar o usuário de auth (que roda com
-- service_role e não passa por RLS nenhum). As duas ficariam dependendo de
-- service_role para uma leitura que o RLS deveria autorizar.
--
-- O alcance continua sendo a própria loja: `manages_store()` é a mesma função
-- que limita cardápio, promoções e métricas. Um gerente vê os colegas dele e
-- ninguém mais.
-- =============================================================================

drop policy managers_select_self on public.managers;

create policy managers_select_team on public.managers
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.manages_store(store_id)
    or public.is_admin()
  );

comment on policy managers_select_team on public.managers is
  'A própria linha, os colegas da mesma loja, e tudo para o admin.';
