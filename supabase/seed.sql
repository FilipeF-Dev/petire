-- =============================================================================
-- Petire — seed de desenvolvimento local
--
-- Roda automaticamente em `npm run db:reset`. NÃO usar em produção: cria
-- usuários com senha conhecida.
--
-- Logins (senha: petire123)
--   gerente@petire.local        gerente da Lanchonete do Zé
--   distribuidora@petire.local  gerente da Distribuidora do Bairro
--   admin@petire.local          admin do Petire
-- =============================================================================

set search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- Lojas
-- ----------------------------------------------------------------------------

insert into public.stores (
  id, slug, name, description, whatsapp_e164,
  address, cep, state_uf, ibge_code, city, neighborhood, lat, lng,
  cuisine_tags, kind, delivery_fee_cents, delivery_minutes, min_order_cents,
  is_active, published_at, subscription_status, subscription_until
) values
(
  '11111111-1111-4111-8111-111111111111',
  'lanchonete-do-ze',
  'Lanchonete do Zé',
  'Hambúrguer artesanal e porções. Do jeito que o bairro gosta desde 2011.',
  '5511987654321',
  'Rua Aspicuelta, 420',
  '05433010', 'SP', '3550308',
  'São Paulo',
  'Vila Madalena',
  -23.5548, -46.6903,
  array['lanches', 'hamburguer', 'porcoes'],
  'food',
  700,
  40,
  2000,
  true,
  now(),
  'trial',
  current_date + 90
),
(
  '22222222-2222-4222-8222-222222222222',
  'distribuidora-do-bairro',
  'Distribuidora do Bairro',
  'Bebida gelada, gelo e carvão. Entrega em até 30 minutos.',
  '5511912345678',
  'Rua Harmonia, 77',
  '05435000', 'SP', '3550308',
  'São Paulo',
  'Vila Madalena',
  -23.5561, -46.6931,
  array['bebidas', 'conveniencia'],
  'drinks',
  500,
  25,
  1500,
  true,
  now(),
  'active',
  current_date + 30
);

-- ----------------------------------------------------------------------------
-- Horários
--   Zé: fechado segunda; sexta e sábado a faixa cruza a meia-noite (18h–02h),
--   que é o caso que store_is_open() precisa acertar.
-- ----------------------------------------------------------------------------

insert into public.store_hours (store_id, weekday, opens_at, closes_at) values
  ('11111111-1111-4111-8111-111111111111', 0, '18:00', '23:00'), -- domingo
  ('11111111-1111-4111-8111-111111111111', 2, '18:00', '23:30'), -- terça
  ('11111111-1111-4111-8111-111111111111', 3, '18:00', '23:30'),
  ('11111111-1111-4111-8111-111111111111', 4, '18:00', '23:30'),
  ('11111111-1111-4111-8111-111111111111', 5, '18:00', '02:00'), -- sexta → sáb
  ('11111111-1111-4111-8111-111111111111', 6, '18:00', '02:00'); -- sábado → dom

insert into public.store_hours (store_id, weekday, opens_at, closes_at)
select '22222222-2222-4222-8222-222222222222', d, '09:00', '23:00'
from generate_series(0, 6) as d;

-- ----------------------------------------------------------------------------
-- Cardápio — Lanchonete do Zé
-- ----------------------------------------------------------------------------

insert into public.menu_categories (id, store_id, name, sort_order) values
  ('c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Lanches',  0),
  ('c2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Porções',  1),
  ('c3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Bebidas',  2);

insert into public.products (id, store_id, category_id, name, description, price_cents, sort_order) values
  ('d1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111',
   'X-Salada', 'Pão brioche, hambúrguer 180g, queijo prato, alface, tomate e maionese da casa.', 2490, 0),
  ('d2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111',
   'X-Bacon', 'Pão brioche, hambúrguer 180g, cheddar e bacon crocante.', 2890, 1),
  ('d3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111',
   'Vegetariano', 'Pão australiano, burger de grão-de-bico, queijo coalho e rúcula.', 2390, 2),
  ('d4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222',
   'Batata frita', 'Batata rústica com alecrim e sal grosso.', 1890, 0),
  ('d5555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222',
   'Calabresa acebolada', 'Calabresa fatiada com cebola caramelizada e pão de alho.', 2490, 1),
  ('d6666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333',
   'Coca-Cola lata 350ml', null, 700, 0),
  ('d7777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333',
   'Coca-Cola 2L', null, 1400, 1),
  ('d8888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333',
   'Suco de laranja 500ml', 'Natural, feito na hora.', 1200, 2);

-- Grupos de opção
insert into public.option_groups (id, store_id, name, min_select, max_select) values
  ('e1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Ponto da carne',        1, 1),
  ('e2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Adicionais',            0, 4),
  ('e3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Remover ingredientes', 0, 3),
  ('e4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Adicionais do bacon',  0, 4),
  ('e5555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Tamanho',               1, 1);

-- Em quais itens cada grupo aparece. "Remover ingredientes" está nos dois
-- hambúrgueres de propósito: é o caso que o modelo antigo obrigava a duplicar,
-- e é o que o painel precisa avisar antes de deixar editar.
insert into public.product_option_groups (store_id, product_id, group_id, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 0),
  ('11111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222', 1),
  ('11111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333333', 2),
  ('11111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222', 'e4444444-4444-4444-8444-444444444444', 0),
  ('11111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222', 'e3333333-3333-4333-8333-333333333333', 1),
  ('11111111-1111-4111-8111-111111111111', 'd4444444-4444-4444-8444-444444444444', 'e5555555-5555-4555-8555-555555555555', 0);

-- Ids fixos também aqui. Com ids aleatórios, todo `db reset` invalidava as
-- páginas já geradas e o carrinho do browser, e o sintoma era um item sumindo
-- do carrinho sem motivo aparente.
insert into public.options (id, store_id, group_id, name, price_delta_cents, sort_order) values
  -- Ponto da carne
  ('0e000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Mal passado',  0, 0),
  ('0e000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Ao ponto',     0, 1),
  ('0e000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Bem passado',  0, 2),
  -- Adicionais
  ('0e000002-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222', 'Bacon',        500, 0),
  ('0e000002-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222', 'Ovo',          300, 1),
  ('0e000002-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222', 'Queijo extra', 400, 2),
  ('0e000002-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222', 'Cheddar',      450, 3),
  -- Remover (delta negativo é permitido de propósito)
  ('0e000003-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333333', 'Sem cebola',    0, 0),
  ('0e000003-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333333', 'Sem tomate',    0, 1),
  ('0e000003-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'e3333333-3333-4333-8333-333333333333', 'Sem maionese',  0, 2),
  -- Adicionais do bacon (grupo próprio: as opções são outras)
  ('0e000004-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'e4444444-4444-4444-8444-444444444444', 'Bacon extra',  600, 0),
  ('0e000004-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'e4444444-4444-4444-8444-444444444444', 'Ovo',          300, 1),
  ('0e000004-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'e4444444-4444-4444-8444-444444444444', 'Cheddar',      450, 2),
  -- Tamanho da batata (o preço base é a pequena)
  ('0e000005-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'e5555555-5555-4555-8555-555555555555', 'Pequena',        0, 0),
  ('0e000005-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'e5555555-5555-4555-8555-555555555555', 'Média',        800, 1),
  ('0e000005-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'e5555555-5555-4555-8555-555555555555', 'Grande',      1500, 2);

insert into public.promotions (store_id, product_id, kind, value, ends_at) values
  ('11111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222', 'percent', 10, now() + interval '30 days');

-- ----------------------------------------------------------------------------
-- Cardápio — Distribuidora do Bairro
-- ----------------------------------------------------------------------------

insert into public.menu_categories (id, store_id, name, sort_order) values
  ('f1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Cervejas',   0),
  ('f2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Sem álcool', 1),
  ('f3333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'Conveniência', 2);

insert into public.products (id, store_id, category_id, name, description, price_cents, is_available, sort_order) values
  ('0d000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'f1111111-1111-4111-8111-111111111111', 'Heineken 600ml', 'Retornável. Troca de casco na entrega.', 1590, true,  0),
  ('0d000001-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'f1111111-1111-4111-8111-111111111111', 'Brahma lata 350ml', null, 450, true,  1),
  ('0d000001-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'f1111111-1111-4111-8111-111111111111', 'Original 600ml', null, 1290, false, 2), -- esgotado
  ('0d000001-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'f2222222-2222-4222-8222-222222222222', 'Coca-Cola 2L', null, 1290, true,  0),
  ('0d000001-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'f2222222-2222-4222-8222-222222222222', 'Água mineral 1,5L', null, 500, true,  1),
  ('0d000001-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333', 'Gelo 5kg', null, 1200, true,  0),
  ('0d000001-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333', 'Carvão 3kg', null, 1800, true,  1);

-- ----------------------------------------------------------------------------
-- Usuários
-- ----------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  crypt('petire123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', u.name),
  '', '', '', ''
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'gerente@petire.local',       'Zé da Lanchonete'),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'distribuidora@petire.local', 'Dona Marta'),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'admin@petire.local',         'Admin Petire')
) as u(id, email, name);

-- Sem a linha em auth.identities o login por e-mail/senha não funciona.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@petire.local';

insert into public.managers (id, store_id, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'manager', 'gerente@petire.local'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'manager', 'distribuidora@petire.local'),
  ('aaaaaaaa-0000-4000-8000-000000000003', null,                                   'admin',   'admin@petire.local');

-- ----------------------------------------------------------------------------
-- Eventos, para o dashboard do gerente ter o que mostrar.
--
-- Sessenta dias e não trinta: o painel compara o mês corrente com o anterior, e
-- sem os dois lados a variação não aparece. O mês anterior vem com volume
-- menor de propósito, para a seta apontar para cima.
-- ----------------------------------------------------------------------------

insert into public.events (store_id, kind, created_at)
select
  s.id,
  k.kind,
  now() - (random() * interval '30 days')
from public.stores s
cross join (values
  ('store_view'::public.event_kind,    120),
  ('whatsapp_click'::public.event_kind, 18)
) as k(kind, n)
cross join lateral generate_series(1, k.n);

insert into public.events (store_id, kind, created_at)
select
  s.id,
  k.kind,
  now() - interval '30 days' - (random() * interval '30 days')
from public.stores s
cross join (values
  ('store_view'::public.event_kind,     95),
  ('whatsapp_click'::public.event_kind, 13)
) as k(kind, n)
cross join lateral generate_series(1, k.n);

-- `cart_add` carrega o produto, e é só ele que carrega: é o que alimenta "o
-- que mais entra no carrinho". Os primeiros itens de cada cardápio ganham mais
-- adições, para o ranking ter o que ordenar.
insert into public.events (store_id, product_id, kind, created_at)
select
  p.store_id,
  p.id,
  'cart_add'::public.event_kind,
  now() - (random() * interval '30 days')
from (
  select
    id,
    store_id,
    row_number() over (partition by store_id order by sort_order, created_at) as rank
  from public.products
) p
cross join lateral generate_series(1, greatest(1, 12 - p.rank * 2));

-- ----------------------------------------------------------------------------
-- Uma loja esperando na fila, para o /admin/pedidos ter o que mostrar.
-- ----------------------------------------------------------------------------

insert into public.store_applications
  (store_name, manager_email, whatsapp_e164, cep, address, city, neighborhood,
   state_uf, ibge_code, kind, note)
values (
  'Pizzaria da Praça',
  'pizzaria@petire.local',
  '5511912345678',
  '05433010',
  'Rua Aspicuelta, 900',
  'São Paulo',
  'Vila Madalena',
  'SP',
  '3550308',
  'food',
  'Abrimos de terça a domingo, das 18h à meia-noite. Meu cardápio está em foto, dá para mandar por WhatsApp?'
);

-- ----------------------------------------------------------------------------
-- Um pagamento já registrado, para o histórico da assinatura não nascer vazio.
-- ----------------------------------------------------------------------------

insert into public.subscription_payments (store_id, amount_cents, paid_on, covers_until, note)
values (
  '11111111-1111-4111-8111-111111111111',
  3000,
  current_date - 20,
  current_date + 10,
  'PIX, comprovante no WhatsApp'
);
