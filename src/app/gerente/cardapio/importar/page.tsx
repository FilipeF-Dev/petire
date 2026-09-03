import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";

import { ImportForm } from "./import-form";

export const metadata: Metadata = {
  title: "Importar cardápio",
  robots: { index: false, follow: false },
};

export default function ImportarCardapioPage() {
  return (
    <div>
      <PageHeader
        title="Importar cardápio"
        description="Cole o cardápio que você já tem e confira antes de gravar."
      />
      <ImportForm />
    </div>
  );
}
