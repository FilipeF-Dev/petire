import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

import { NewStoreForm } from "./new-store-form";

export const metadata: Metadata = {
  title: "Nova loja",
  robots: { index: false, follow: false },
};

export default async function NovaLojaPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="Nova loja"
        description="Cria a loja e o login do lojista. A loja entra fora do ar até o cardápio ficar pronto."
      />
      <NewStoreForm />
    </div>
  );
}
