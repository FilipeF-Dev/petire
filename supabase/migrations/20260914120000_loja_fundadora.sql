-- =============================================================================
-- Petire — a loja fundadora
--
-- "As dez primeiras lojas de cada bairro entram com 90 dias grátis e R$ 29
-- travados" é a peça comercial que faz o lojista decidir hoje em vez de
-- pensar. Até aqui ela existia só no acordo verbal e em `docs/precos.md` —
-- o banco não sabia o que era uma loja fundadora, e três coisas ficavam
-- quebradas por causa disso.
--
-- 1. O teste contava do cadastro, não da publicação. Quem demora a mandar o
--    cardápio queima o teste esperando por si mesmo e chega ao dia 91 com três
--    semanas de catálogo e nenhum número — justo quando o número é o único
--    argumento de renovação que existe.
-- 2. A vaga de fundadora era uma frase de venda. Escassez que ninguém conta é
--    escassez que se gasta: bastava marcar a décima primeira e a promessa
--    virava conversa fiada.
-- 3. `store_item_limit()` não conhecia a fundadora, então a distribuidora que
--    entrasse por R$ 29 batia no teto de 100 itens colando o cardápio — no
--    passo do onboarding que já é o mais frágil.
--
-- Uma coluna resolve as três, e é a mesma decisão nos três casos: o que é
-- promessa comercial vira regra do banco.
-- =============================================================================

alter table public.stores
  add column is_founder   boolean not null default false,
  add column published_at timestamptz;

comment on column public.stores.is_founder is
  'Uma das primeiras lojas do bairro: preço travado e teto de itens do Plus. Ver docs/precos.md.';

comment on column public.stores.published_at is
  'Quando a loja entrou no ar pela primeira vez. É daqui que o teste conta.';

-- O gerente não marca a si mesmo como fundadora nem se publica, pelo mesmo
-- motivo de `plan` e `subscription_status`: quem decide isso é quem cobra.
-- Nenhuma das duas entra no GRANT UPDATE de `authenticated`.

-- As lojas que já estão no ar entraram antes desta coluna existir, e o gatilho
-- abaixo só carimba publicações futuras. Sem este backfill, o painel diria
-- "ainda não entrou no ar" sobre uma loja que está no ar há meses.
--
-- `created_at` é uma aproximação, e é a melhor que existe: a data real da
-- publicação não foi registrada em lugar nenhum. Para o teste isso é inofensivo
-- — quem já está no ar há tempo não tem teste deslizando — e é o valor que a
-- tela precisa para dizer a verdade.
update public.stores
set published_at = created_at
where is_active and published_at is null;

-- ----------------------------------------------------------------------------
-- 1. O teste conta de quando a loja entra no ar
--
-- O tamanho do teste não é decidido aqui: ele é o que o admin concedeu no
-- cadastro. O que muda é o começo — a janela desliza inteira para a data da
-- publicação, mantendo os mesmos dias.
--
-- Só na **primeira** publicação. Sem isso, suspender e republicar uma loja
-- seria uma máquina de dias grátis.
-- ----------------------------------------------------------------------------

create or replace function public.stamp_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  granted integer;
  live_on date;
begin
  if not (new.is_active and not old.is_active and new.published_at is null) then
    return new;
  end if;

  new.published_at := now();

  if new.subscription_status = 'trial' and new.subscription_until is not null then
    -- Quantos dias foram concedidos, contados de onde eles contavam antes.
    granted := new.subscription_until - (new.created_at at time zone 'America/Sao_Paulo')::date;
    live_on := (new.published_at at time zone 'America/Sao_Paulo')::date;

    -- Publicada no mesmo dia do cadastro não ganha nem perde nada, e o
    -- `> 0` protege contra um vencimento já vencido virar data futura.
    if granted > 0 then
      new.subscription_until := live_on + granted;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.stamp_publication() is
  'Marca a primeira publicação e desliza o teste para começar nela. Só na primeira vez.';

create trigger stores_stamp_publication
  before update on public.stores
  for each row execute function public.stamp_publication();

-- ----------------------------------------------------------------------------
-- 2. A vaga de fundadora acaba de verdade
--
-- O número mora aqui, como o teto de itens: trocar quantas vagas um bairro tem
-- é editar uma linha de SQL, sem tocar em app. A cópia em `src/lib/pricing.ts`
-- é a que aparece na vitrine e no material de venda, e as duas **precisam**
-- concordar — mesma relação de `slugify()` entre o banco e o app.
-- ----------------------------------------------------------------------------

create or replace function public.founder_slots()
returns integer
language sql
immutable
as $$
  select 10;
$$;

comment on function public.founder_slots() is
  'Quantas lojas fundadoras cabem por bairro. Gêmea de FOUNDER_SLOTS em src/lib/pricing.ts.';

create or replace function public.founder_slots_left(
  target_city text,
  target_neighborhood text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    public.founder_slots() - (
      select count(*)
      from public.stores s
      where s.city_slug = target_city
        and s.neighborhood_slug = target_neighborhood
        and s.is_founder
    )::integer
  );
$$;

comment on function public.founder_slots_left(text, text) is
  'Vagas de fundadora que ainda restam no bairro. É o número que a venda promete.';

revoke all on function public.founder_slots_left(text, text) from public, anon, authenticated;

create or replace function public.enforce_founder_slots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken integer;
begin
  -- Só quando a loja passa a ser fundadora. Editar o endereço de uma que já é
  -- não pode falhar por causa de uma vaga que ela mesma ocupa.
  if not new.is_founder then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.is_founder then
    return null;
  end if;

  select count(*)
  into taken
  from public.stores s
  where s.city_slug = new.city_slug
    and s.neighborhood_slug = new.neighborhood_slug
    and s.is_founder
    and s.id <> new.id;

  if taken >= public.founder_slots() then
    -- PT422: o PostgREST transforma PTxyz no status HTTP xyz, e a mensagem
    -- chega à tela como está escrita aqui.
    raise exception
      'Este bairro já tem % lojas fundadoras.', public.founder_slots()
      using errcode = 'PT422';
  end if;

  return null;
end;
$$;

comment on function public.enforce_founder_slots() is
  'Recusa a fundadora número onze de um bairro. A escassez que a venda promete é esta.';

-- AFTER, e não BEFORE: `city_slug` e `neighborhood_slug` são colunas geradas, e
-- elas só existem em NEW depois que os gatilhos BEFORE terminam. Um raise aqui
-- aborta a transação do mesmo jeito.
create trigger stores_respect_founder_slots
  after insert or update on public.stores
  for each row execute function public.enforce_founder_slots();

-- ----------------------------------------------------------------------------
-- 3. A fundadora entra com o teto do Plus
--
-- Metade do público que o Petire foi buscar é distribuidora, e um teto de 100
-- itens é, para ela, uma parede no primeiro dia. Se ela bate nessa parede
-- durante os 90 dias grátis, a conversa deixa de ser "veja quantos pedidos
-- chegaram" e vira "por que meu cardápio não coube".
--
-- O teto é defensivo: ele existe para o catálogo não virar depósito, não para
-- ser vendido. Por isso ele acompanha a fundadora, e os degraus que são
-- **oferta** — equipe, relatório, promoção que se repete — continuam sendo do
-- Plus. Fundadora ganha o que a impediria de começar, não o que ela compraria.
-- ----------------------------------------------------------------------------

create or replace function public.store_item_limit(target uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when s.plan = 'plus' or s.is_founder then 1000
        else 100
      end
      from public.stores s
      where s.id = target
    ),
    100
  );
$$;

comment on function public.store_item_limit(uuid) is
  'Quantos itens o cardápio da loja pode ter, pelo plano dela ou por ser fundadora. Os números são o botão comercial.';
