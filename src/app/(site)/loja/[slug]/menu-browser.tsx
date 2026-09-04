"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { slugify } from "@/lib/slug";

import { MenuItem, type MenuProduct } from "./menu-item";

/**
 * O cardápio, com índice e busca.
 *
 * A página empilhava todas as categorias em sequência. Isso funciona para a
 * lanchonete de trinta itens e não funciona para a distribuidora, que tem
 * centenas de rótulos quase iguais — e distribuidora é metade do público que o
 * Petire foi buscar. Esta é a tela que converte: se ela vira rolagem infinita
 * no celular, o pedido não acontece.
 *
 * Duas saídas, porque são duas perguntas diferentes. Quem sabe o que quer
 * ("guaraná") busca. Quem está decidindo passeia pelas categorias, e a barra
 * fixa é o índice que o cardápio de papel tem e a página não tinha.
 *
 * A filtragem é no browser de propósito: o cardápio inteiro já veio no HTML —
 * é ele que o Google indexa e é dele que a página vive. Ir ao servidor a cada
 * tecla jogaria isso fora e ainda seria mais lento.
 */

export type MenuSection = {
  id: string;
  name: string;
  items: MenuProduct[];
};

/** Um item casa pelo nome ou pela descrição: "sem lactose" costuma estar lá. */
function haystack(product: MenuProduct): string {
  return slugify(`${product.name} ${product.description ?? ""}`);
}

function sectionAnchor(id: string): string {
  return `secao-${id}`;
}

export function MenuBrowser({
  storeId,
  storeIsOpen,
  sections,
}: {
  storeId: string;
  storeIsOpen: boolean;
  sections: MenuSection[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);

  // Mesmo tratamento dos dois lados, como na busca de lojas: acento, caixa e
  // pontuação saem de cena antes da comparação.
  const term = slugify(query);

  const indexed = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          product: item,
          text: haystack(item),
        })),
      })),
    [sections],
  );

  const visible = useMemo(() => {
    if (!term) return sections;

    return indexed
      .map((section) => ({
        id: section.id,
        name: section.name,
        items: section.items
          .filter((entry) => entry.text.includes(term))
          .map((entry) => entry.product),
      }))
      .filter((section) => section.items.length > 0);
  }, [indexed, sections, term]);

  const found = visible.reduce((total, section) => total + section.items.length, 0);

  // Qual categoria está sob os olhos agora. Sem isso a barra fixa mostra as
  // categorias mas não diz onde a pessoa está, que é metade do que um índice
  // faz.
  const headings = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (term) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (onScreen[0]) setActive(onScreen[0].target.id.replace("secao-", ""));
      },
      // A faixa começa logo abaixo da barra e termina no meio da tela: assim a
      // categoria só troca quando a próxima realmente assume a leitura.
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );

    for (const element of headings.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [term, sections]);

  const showIndex = !term && sections.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="busca-cardapio">
          Buscar no cardápio
        </label>
        <input
          id="busca-cardapio"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar no cardápio"
          className="w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
        />

        {showIndex ? (
          <nav
            aria-label="Categorias do cardápio"
            className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0"
          >
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {sections.map((section) => {
                const isActive = active === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${sectionAnchor(section.id)}`}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        isActive
                          ? "block shrink-0 rounded-full border border-neutral-900 bg-neutral-900 px-3.5 py-1.5 text-sm whitespace-nowrap text-white dark:border-white dark:bg-white dark:text-neutral-900"
                          : "block shrink-0 rounded-full border border-neutral-300 bg-surface px-3.5 py-1.5 text-sm whitespace-nowrap transition hover:bg-surface-hover dark:border-neutral-700"
                      }
                    >
                      {section.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        {term ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {found === 0
              ? "Nenhum item com esse nome."
              : `${found} ${found === 1 ? "item" : "itens"} no cardápio.`}
          </p>
        ) : null}
      </div>

      {visible.map((section) => (
        <section key={section.id}>
          <h2
            id={sectionAnchor(section.id)}
            // O deslocamento tira o título de baixo da barra fixa quando o
            // link do índice pula para cá.
            ref={(element) => {
              if (element) headings.current.set(section.id, element);
              else headings.current.delete(section.id);
            }}
            className="mb-3 scroll-mt-16 text-sm font-semibold tracking-wide uppercase"
          >
            {section.name}
          </h2>

          <ul className="flex flex-col gap-2">
            {section.items.map((product) => (
              <li key={product.id}>
                <MenuItem
                  storeId={storeId}
                  storeIsOpen={storeIsOpen}
                  product={product}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
