-- =============================================================================
-- Petire — a segunda metade da entrega dos grupos compartilhados
--
-- A migration 20260918120000 criou a tabela de ligação e **deixou** de pé as
-- duas colunas antigas de `option_groups`, só afrouxando o NOT NULL. Não foi
-- descuido: naquela hora o banco subiu antes do código, e quem estava no ar
-- ainda lia `sort_order` e filtrava por `product_id`. Apagar ali teria deixado
-- a vitrine sem cardápio pela duração do deploy.
--
-- Agora o código novo está no ar há tempo suficiente, e nenhum caminho de
-- leitura ou escrita toca nestas colunas: os grupos de um item vêm de
-- `product_option_groups`, e a ordem vem de lá também. O que sobra é peso
-- morto que ainda aceita escrita — e coluna que ninguém lê mas alguém pode
-- gravar é a origem de dois lugares dizendo coisas diferentes.
--
-- É a segunda entrega da regra que o README enuncia: primeiro o código para de
-- usar, depois a coluna sai.
-- =============================================================================

alter table public.option_groups drop column product_id;
alter table public.option_groups drop column sort_order;
