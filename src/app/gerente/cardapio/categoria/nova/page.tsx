import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = {
  title: "Nova categoria",
  robots: { index: false, follow: false },
};

export default function NovaCategoriaPage() {
  return (
    <div>
      <PageHeader
        title="Nova categoria"
        description="Categorias são as seções do cardápio: Lanches, Porções, Bebidas."
      />
      <CategoryForm />
    </div>
  );
}
