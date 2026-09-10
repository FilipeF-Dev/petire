-- =============================================================================
-- Petire — registrar também a busca que deu certo
--
-- `demand_signals` só guardava o beco sem saída: busca sem resultado e cidade
-- sem loja. Isso responde "onde abrir o próximo bairro", e é pouco para quem
-- já está dentro.
--
-- O lojista tem outra pergunta, e ela é a mais valiosa que o Petire pode
-- responder: **o que as pessoas procuram aqui perto que o meu cardápio não
-- tem?** Se o vizinho vende açaí, a busca por açaí funciona e nenhum sinal é
-- gravado hoje — mas para a loja ao lado aquilo foi uma venda que passou na
-- frente dela.
--
-- Guardar a busca que deu certo é o que permite cruzar o que se procura no
-- bairro com o cardápio de cada loja. Continua sem nada pessoal: lugar e
-- termo, como as outras duas.
-- =============================================================================

alter type public.demand_kind add value if not exists 'search_hit';

comment on type public.demand_kind is
  'search_empty: procurou e o catálogo não tinha. area_uncovered: cidade sem loja. search_hit: procurou e achou — é o que diz o que o bairro pede.';
