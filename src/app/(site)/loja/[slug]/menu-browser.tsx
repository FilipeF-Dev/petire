"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { matchesTerms, searchTerms, slugify } from "@/lib/slug";

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

/** O termo que veio no link do resultado da busca, ou vazio. */
function readHash(): string {
  const hash = window.location.hash;
  if (!hash.startsWith("#q=")) return "";

  try {
    return decodeURIComponent(hash.slice(3));
  } catch {
    // Fragmento malformado é ruído de link quebrado, não erro do cliente.
    return "";
  }
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
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
  /*
    Quem chegou de um item da busca cai com o cardápio já filtrado nele.

    O termo vem no **fragmento** da URL (`#q=xtudo`), e não na query string,
    porque esta página é estática: ler `searchParams` a tornaria dinâmica, e ela
    é a mais visitada do site. O fragmento não chega ao servidor.

    Lido por `useSyncExternalStore` e não num efeito: no servidor e na primeira
    pintura ele vale vazio, que é o que a hidratação precisa encontrar, e o
    valor de verdade entra logo depois. Assim que o cliente digita, `typed`
    assume e o fragmento para de mandar — senão o campo brigaria com ele.
  */
  const fromHash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? fromHash;
  const setQuery = setTyped;

  const [active, setActive] = useState<string | null>(null);

  // Mesmo tratamento dos dois lados, como na busca de lojas: acento, caixa e
  // pontuação saem de cena antes da comparação, e cada palavra é um filtro que
  // precisa bater. Com o slug inteiro, quem digita "suco laranja" não acha
  // "Suco de laranja 500ml" — o "de" no meio quebra a sequência.
  //
  // Memoizado porque é dependência de um `useMemo` e de um `useEffect`: um
  // array novo a cada render refiltraria o cardápio e religaria o observador da
  // barra de categorias sem nada ter mudado.
  const terms = useMemo(() => searchTerms(query), [query]);

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
    if (terms.length === 0) return sections;

    return indexed
      .map((section) => ({
        id: section.id,
        name: section.name,
        items: section.items
          .filter((entry) => matchesTerms(entry.text, terms))
          .map((entry) => entry.product),
      }))
      .filter((section) => section.items.length > 0);
  }, [indexed, sections, terms]);

  const found = visible.reduce(
    (total, section) => total + section.items.length,
    0,
  );

  // Qual categoria está sob os olhos agora. Sem isso a barra fixa mostra as
  // categorias mas não diz onde a pessoa está, que é metade do que um índice
  // faz.
  const headings = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (terms.length > 0) return;

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
  }, [terms, sections]);

  const showIndex = terms.length === 0 && sections.length > 1;

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

        {terms.length > 0 ? (
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
