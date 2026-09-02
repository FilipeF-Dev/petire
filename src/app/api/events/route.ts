import { NextResponse } from "next/server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Gravação de métricas.
 *
 * O browser não tem permissão de escrita em `events` — se tivesse, qualquer um
 * inflaria com um loop de fetch os números que justificam a mensalidade da
 * loja. Então a escrita passa por aqui, com service_role, depois de conferir
 * que a loja existe e é pública.
 *
 * Isto não é à prova de fraude: quem quiser ainda pode chamar esta rota em
 * loop. Quando o volume justificar, o próximo passo é rate limit por IP.
 */

const bodySchema = z.object({
  storeId: z.uuid(),
  kind: z.enum(["store_view", "cart_add", "whatsapp_click"]),
  productId: z.uuid().optional(),
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

  // Conferido com o cliente anônimo: assim quem decide se a loja é pública é
  // o próprio RLS, e não uma regra repetida aqui.
  const supabase = createPublicClient();
  const { data: store } = await supabase
    .from("stores_public")
    .select("id")
    .eq("id", parsed.data.storeId)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "loja não encontrada" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("events").insert({
    store_id: parsed.data.storeId,
    product_id: parsed.data.productId ?? null,
    kind: parsed.data.kind,
  });

  if (error) {
    return NextResponse.json({ error: "falha ao gravar" }, { status: 500 });
  }

  // 204: o browser manda isto por sendBeacon e não lê a resposta.
  return new NextResponse(null, { status: 204 });
}
