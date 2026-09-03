# Petire — Especificação do MVP (v1)

> Documento derivado de `Petire CoreV1.txt`. Define o que entra no v1, o modelo de
> dados, os fluxos e a ordem de construção.

---

## 1. Decisões fechadas

| Área | Decisão |
|---|---|
| Stack | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Deploy | Vercel |
| PWA | `next-pwa` — manifest + service worker, shell offline |
| Localização | Seletor manual de cidade/bairro (sem geolocalização no v1) |
| Variações de produto | Sim — grupos de opções (tamanho, adicionais, remoções) |
| Pagamento da assinatura | Manual (PIX) + ativação pelo admin |
| Login do cliente | Não existe |

**Por que Next.js e não SPA:** as páginas `/loja/[slug]` são renderizadas no servidor
e indexadas pelo Google com JSON-LD `Restaurant`. Esse é o canal de aquisição
gratuito do Petire — uma SPA jogaria isso fora.

---

## 2. Escopo

### Dentro do v1

**Cliente (público, sem login)**
- Home com seletor de cidade/bairro (persistido em `localStorage`)
- Lista de lojas com filtros: categoria (comida / bebida), tipo de culinária, aberto agora
- Busca por nome de loja e por produto
- Página da loja: cardápio por categorias, horário, status aberto/fechado, taxa e pedido mínimo
- Item com opções (tamanho, adicionais, observações)
- Carrinho **multi-loja**, agrupado por loja, persistido em `localStorage`
- Checkout por loja → deep link `wa.me` com o pedido pronto

**Gerente (login)**
- Dashboard da própria loja
- CRUD de categorias e produtos, upload de imagem
- Toggle "esgotado" em um toque (mobile-first)
- Promoções (% ou valor fixo, com janela de vigência)
- Horários de funcionamento e status manual aberto/fechado
- Dados da loja (nome, logo, capa, WhatsApp, endereço, taxa, pedido mínimo)
- Métricas simples: visitas e cliques em "Fazer pedido" nos últimos 30 dias

**Admin (você)**
- Criar loja e conta do gerente
- Ativar / suspender assinatura
- Listar lojas com status e vencimento

### Fora do v1

Gateway de pagamento · login e histórico de cliente · avaliações · cupons ·
rastreio de entrega · chat interno · publicidade paga · app nativo ·
geolocalização por raio · multi-gerente por loja.

---

## 3. Fluxos

### 3.1 Cliente
```
Home → define bairro → lista de lojas → [filtra] → loja → item (+opções)
     → carrinho (agrupado por loja) → "Fazer pedido" na loja X → WhatsApp da loja X
```
O carrinho **não** é esvaziado ao enviar. O cliente pode voltar e enviar o pedido da
loja Y em seguida. Cada loja é um envio separado — não existe pedido consolidado.

### 3.2 Gerente
```
/gerente/login → dashboard → cardápio → editar/criar item → salvar (publica na hora)
```

### 3.3 Admin
```
/admin → nova loja → gera credenciais do gerente → marca assinatura ativa até <data>
```

---

## 4. Modelo de dados

```
stores
  id, slug (unique), name, description, logo_url, cover_url,
  whatsapp_e164, address, city, neighborhood, lat, lng,
  cuisine_tags text[], kind ('food' | 'drinks' | 'both'),
  delivery_fee_cents, min_order_cents,
  is_active bool, is_open_manual bool,
  subscription_status ('trial'|'active'|'past_due'|'suspended'),
  subscription_until date, created_at

store_hours
  id, store_id, weekday (0-6), opens_at time, closes_at time

menu_categories
  id, store_id, name, sort_order

products
  id, store_id, category_id, name, description,
  price_cents, image_url, is_available bool, sort_order

option_groups
  id, product_id, name, min_select, max_select, sort_order

options
  id, group_id, name, price_delta_cents, is_available bool, sort_order

promotions
  id, store_id, product_id (nullable), kind ('percent'|'fixed'),
  value, starts_at, ends_at, is_active bool

managers
  id (= auth.users.id), store_id, role ('manager'|'admin'), email

events
  id, store_id, product_id (nullable),
  kind ('store_view'|'cart_add'|'whatsapp_click'),
  created_at
```

**Notas**

- Todo dinheiro em **centavos inteiros**. Nunca `float`.
- `whatsapp_e164` normalizado na escrita: `5511987654321`, sem `+`, sem máscara.
- Obrigatório é o mesmo que `min_select >= 1` — não existe coluna `required`,
  porque as duas poderiam divergir. Escolha única é `max_select = 1`.
- RLS: leitura pública de lojas com `is_active = true` e assinatura não suspensa;
  escrita apenas pelo gerente da própria loja; `events` aceita insert anônimo.
- `events` é o que prova valor na renovação: *"você recebeu 84 pedidos pelo Petire
  este mês"*. Como o pedido acontece fora do site, sem essa tabela você fica cego.

---

## 5. Mensagem do WhatsApp

### Formato
```
*Pedido via Petire*
──────────────
2x Hambúrguer X-Salada      R$ 45,00
   + bacon extra
   - sem cebola
1x Coca-Cola 2L             R$ 12,00
──────────────
Subtotal: R$ 57,00
Entrega: a combinar

Nome:
Endereço:
Pagamento:
```

### Regras
- URL: `https://wa.me/<whatsapp_e164>?text=<encodeURIComponent(texto)>`
- Manter abaixo de **~2000 caracteres**. Acima disso, colapsar as opções dos itens
  e, se ainda estourar, enviar só as linhas de item sem detalhes.
- Não pré-preencher nome/endereço/pagamento — o cliente completa no WhatsApp.
- Registrar `whatsapp_click` **antes** de redirecionar.
- Usar `window.location.href` (não `window.open`) para não ser bloqueado no iOS.

---

## 6. Rotas

| Rota | Render | Descrição |
|---|---|---|
| `/` | SSG | Home, seletor de bairro |
| `/lojas` | SSR | Lista filtrável |
| `/loja/[slug]` | ISR | Cardápio público — **página de SEO** |
| `/carrinho` | Client | Carrinho multi-loja |
| `/entrar` | Client | Auth |
| `/gerente` | SSR | Dashboard |
| `/gerente/cardapio` | SSR | CRUD |
| `/gerente/promocoes` | SSR | Descontos por item ou no cardápio todo |
| `/gerente/loja` | SSR | Dados da loja e horários |
| `/admin` | SSR | Gestão de lojas e assinaturas |
| `/sitemap.xml` | Dynamic | Todas as lojas ativas |

---

## 7. Fases de construção

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0** | Projeto, schema, RLS, auth, seed de 1 loja | `supabase db push` roda limpo; login do gerente funciona |
| **1** | Painel do gerente: CRUD de cardápio + opções + imagens | Gerente monta um cardápio real do zero pelo celular |
| **2** | Vitrine pública: lista, filtros, página da loja | Cardápio da fase 1 aparece corretamente em `/loja/[slug]` |
| **3** | Carrinho multi-loja + checkout WhatsApp + `events` | Pedido chega formatado no WhatsApp de teste |
| **4** | PWA, SEO (JSON-LD, sitemap, OG), admin, deploy | Instalável no Android/iOS; loja indexável |
| **5** | Onboarding das primeiras lojas reais | 10 lojas ativas em um bairro |

---

## 8. Riscos

**Ovo-e-galinha.** Sem lojas não há clientes, sem clientes as lojas não renovam.
Mitigação: lançar **um bairro por vez**; as 10 primeiras lojas entram grátis por 3 meses.

**Cardápio desatualizado.** É o que mata a confiança do cliente mais rápido.
Mitigação: "esgotado" tem que ser um toque, e o painel precisa funcionar bem no celular.

**Você não vê o pedido.** O pedido é fechado no WhatsApp, fora do sistema.
Mitigação: `events` + relatório mensal por loja. É o seu argumento de renovação.

**R$30/mês não paga suporte humano.** Excelente para aquisição, apertado para operação.
Mitigação: onboarding self-service e documentação; reavaliar o preço na 50ª loja.

---

## 9. Métricas do MVP

- Cliques em "Fazer pedido" por loja / semana ← **métrica principal**
- Lojas ativas e taxa de renovação mensal
- Visitantes únicos por bairro
- Taxa carrinho → WhatsApp
