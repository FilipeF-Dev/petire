import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ImportForm } from "./import-form";

export const metadata: Metadata = {
  title: "Importar cardápio",
  robots: { index: false, follow: false },
};

export default async function ImportarCardapioPage() {
  const session = await requireManager();
  const supabase = await createClient();

  /*
    Quanto ainda cabe, buscado aqui para a tela poder avisar **antes** de a
    pessoa montar e colar o cardápio inteiro. A recusa do banco continua sendo
    a palavra final — esta é só a cortesia de não deixar ninguém descobrir no
    último clique.
  */
  const [usados, teto] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", session.storeId ?? "")
      .then((resultado) => resultado.count ?? 0),
    supabase
      .rpc("store_item_limit", { target: session.storeId ?? "" })
      .then((resultado) => resultado.data ?? 0),
  ]);

  return (
    <div>
      <PageHeader
        title="Importar cardápio"
        description="Cole o cardápio que você já tem e confira antes de gravar."
      />
      <ImportForm espaco={{ usados, teto }} />
    </div>
  );
}
