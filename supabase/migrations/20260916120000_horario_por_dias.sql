-- ----------------------------------------------------------------------------
-- Uma faixa de horário não pode ser cadastrada duas vezes no mesmo dia
-- ----------------------------------------------------------------------------
--
-- O formulário do painel passou a marcar vários dias de uma vez, e com isso o
-- caminho mais natural do lojista virou "marco a semana inteira e salvo" — em
-- cima de dias que já tinham a faixa. Sem esta restrição cada repetição criaria
-- uma linha nova, e a loja apareceria com "18:00 – 23:00" duas vezes na página
-- pública e no schema.org, sem nada explicando por quê.
--
-- É índice único, e não uma checagem no aplicativo, porque quem grava aqui é o
-- gerente autenticado direto pelo PostgREST: a regra precisa valer para
-- qualquer caminho de escrita, não só para o formulário que a motivou.

-- Duplicatas que já existirem: fica a mais antiga, que é a que o lojista
-- cadastrou de propósito. `ctid` desempata sem precisar de created_at, que pode
-- ser idêntico entre linhas gravadas no mesmo insert.
delete from public.store_hours a
using public.store_hours b
where a.store_id  = b.store_id
  and a.weekday   = b.weekday
  and a.opens_at  = b.opens_at
  and a.closes_at = b.closes_at
  and a.ctid > b.ctid;

create unique index if not exists store_hours_range_unique
  on public.store_hours (store_id, weekday, opens_at, closes_at);
