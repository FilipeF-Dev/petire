import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { setProductAvailability } from "./actions";
import { AvailabilityToggle } from "./availability-toggle";
import { ReorderButtons } from "./reorder-buttons";

export const metadata: Metadata = {
  title: "Cardápio",
  robots: { index: false, follow: false },
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  image_url: string | null;
  category_id: string | null;
};

function ProductRow({
  product,
  scopeId,
  isFirst,
  isLast,
}: {
  product: Product;
  scopeId: string | null;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3 first:border-t-0 dark:border-neutral-800">
      <Link
        href={`/gerente/cardapio/produto/${product.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[10px] text-neutral-400">
              foto
            </span>
          )}
        </div>

        <div className="min-w-0">
          {/* Sem truncate: no celular, "Coca-Cola lata 350ml" e "Coca-Cola 2L"
              viram a mesma coisa se cortar. Duas linhas é melhor que ambíguo. */}
          <p className="font-medium">{product.name}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {formatCents(product.price_cents)}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <AvailabilityToggle
          id={product.id}
          idFieldName="productId"
          isAvailable={product.is_available}
          action={setProductAvailability}
        />
        <ReorderButtons
          table="products"
          itemId={product.id}
          scopeId={scopeId}
          isFirst={isFirst}
          isLast={isLast}
          label={product.name}
        />
      </div>
    </li>
  );
}

export default async function CardapioPage() {
  const session = await requireManager();

  if (!session.storeId) {
    return <p className="text-sm">Sua conta não está vinculada a uma loja.</p>;
  }

  const supabase = await createClient();

  const [categoriesResult, productsResult, limitResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("store_id", session.storeId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("products")
      .select(
        "id, name, description, price_cents, is_available, image_url, category_id",
      )
      .eq("store_id", session.storeId)
      .order("sort_order")
      .order("created_at"),
    supabase.rpc("store_item_limit", { target: session.storeId }),
  ]);

  const categories = categoriesResult.data ?? [];
  const products = productsResult.data ?? [];

  // O teto só aparece quando está perto de importar. Mostrar "8 de 100" para
  // quem tem oito itens é ruído, e pior: sugere um limite onde não há problema
  // nenhum. Quem já usou 80% precisa saber antes de colar um cardápio inteiro.
  const itemLimit = limitResult.data ?? 0;
  const nearLimit = itemLimit > 0 && products.length >= itemLimit * 0.8;
  const uncategorized = products.filter((p) => p.category_id === null);

  const sections = [
    ...categories.map((category) => ({
      id: category.id as string | null,
      name: category.name,
      editable: true,
      items: products.filter((p) => p.category_id === category.id),
    })),
    ...(uncategorized.length > 0
      ? [
          {
            id: null,
            name: "Sem categoria",
            editable: false,
            items: uncategorized,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Cardápio"
        description={
          nearLimit
            ? `${products.length} de ${itemLimit} itens do seu plano, em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`
            : `${products.length} ${products.length === 1 ? "item" : "itens"} em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/gerente/cardapio/importar">
              <Button variant="secondary">Colar cardápio</Button>
            </Link>
            <Link href="/gerente/cardapio/categoria/nova">
              <Button variant="secondary">Nova categoria</Button>
            </Link>
            <Link href="/gerente/cardapio/produto/novo">
              <Button>Novo item</Button>
            </Link>
          </div>
        }
      />

      {sections.length === 0 ? (
        <EmptyState
          title="Seu cardápio está vazio"
          description="Já tem o cardápio escrito em algum lugar? Cole aqui de uma vez."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/gerente/cardapio/importar">
                <Button>Colar cardápio</Button>
              </Link>
              <Link href="/gerente/cardapio/categoria/nova">
                <Button variant="secondary">Criar categoria</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section, sectionIndex) => (
            <section key={section.id ?? "sem-categoria"}>
              <div className="mb-2 flex items-center gap-2">
                {section.editable ? (
                  <ReorderButtons
                    table="menu_categories"
                    itemId={section.id!}
                    isFirst={sectionIndex === 0}
                    isLast={sectionIndex === categories.length - 1}
                    label={section.name}
                  />
                ) : null}

                <h2 className="flex-1 text-sm font-semibold tracking-wide uppercase">
                  {section.name}
                </h2>

                {section.editable ? (
                  <Link
                    href={`/gerente/cardapio/categoria/${section.id}`}
                    className="text-xs text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
                  >
                    editar
                  </Link>
                ) : null}
              </div>

              <Card>
                {section.items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                    Nenhum item nesta categoria.
                  </p>
                ) : (
                  <ul>
                    {section.items.map((product, index) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        scopeId={section.id}
                        isFirst={index === 0}
                        isLast={index === section.items.length - 1}
                      />
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
