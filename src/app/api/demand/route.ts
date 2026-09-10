import { NextResponse } from "next/server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gravação dos sinais de demanda não atendida.
 *
 * Mesma regra de /api/events, pelo mesmo motivo: o browser não escreve na
 * tabela. Se escrevesse, qualquer um fabricaria demanda para um bairro — e é
 * por este número que o próximo bairro vai ser escolhido.
 *
 * Diferente de /api/events, aqui não há loja para conferir: o sinal existe
 * justamente porque não havia loja. O que dá para conferir é o formato, e é o
 * que o schema faz.
 *
 * Como lá, isto não é à prova de fraude — quem quiser ainda chama a rota em
 * loop. Quando o volume justificar, o próximo passo é rate limit por IP.
 */

const SLUG = /^[a-z0-9-]{1,120}$/;

const bodySchema = z.object({
  kind: z.enum(["search_empty", "area_uncovered", "search_hit"]),
  citySlug: z.string().regex(SLUG).nullish(),
  neighborhoodSlug: z.string().regex(SLUG).nullish(),
  term: z.string().max(80).nullish(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const { kind, citySlug, neighborhoodSlug } = parsed.data;

  // Espaço repetido e caixa alta fariam "Coxinha", "coxinha " e "coxinha"
  // virarem três linhas diferentes no relatório, e o termo mais procurado
  // ficaria escondido atrás das próprias variações.
  const term = parsed.data.term?.trim().replace(/\s+/g, " ").toLowerCase();

  // Espelha o CHECK da tabela: sinal sem lugar nem termo não diz nada. Barrado
  // aqui para virar 400 em vez de erro de banco.
  if (!citySlug && !term) {
    return NextResponse.json({ error: "sinal vazio" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("demand_signals").insert({
    kind,
    city_slug: citySlug ?? null,
    neighborhood_slug: neighborhoodSlug ?? null,
    term: term || null,
  });

  if (error) {
    return NextResponse.json({ error: "falha ao gravar" }, { status: 500 });
  }

  // 204: quem chama manda por sendBeacon e não lê a resposta.
  return new NextResponse(null, { status: 204 });
}
