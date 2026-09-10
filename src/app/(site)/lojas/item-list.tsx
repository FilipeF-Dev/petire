import Image from "next/image";
import Link from "next/link";

import { formatCents } from "@/lib/money";

export type MatchedItem = {
  id: string;
  name: string;
  priceCents: number;
  /** Preço de tabela, presente só quando há desconto valendo agora. */
  originalCents: number | null;
  discountLabel: string | null;
  storeSlug: string;
  storeName: string;
  storeNeighborhood: string;
  storeIsOpen: boolean;
  /** Foto do item. Nula é o caso comum: cardápio novo entra sem foto. */
  imageUrl: string | null;
  /** Logo da loja, que entra no lugar da foto quando ela não existe. */
  storeLogoUrl: string | null;
};

/**
 * Os itens que casaram com a busca, cada um com a loja que o vende.
 *
 * Antes, procurar "picanha" devolvia **lojas**, com um "tem Picanha" em letra
 * pequena embaixo do nome. Mas quem procura um prato quer ver o prato: o nome,
 * o preço, e um caminho direto até ele. A lista de lojas continua acima — ela
 * responde "onde comprar", e esta responde "o que eu queria".
 */
export function ItemList({
  items,
  term,
}: {
  items: MatchedItem[];
  /** O que foi digitado, para a loja já abrir com o cardápio filtrado. */
  term: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        Itens encontrados
      </h2>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              /*
                O termo vai no fragmento, e não na query string, de propósito:
                a página da loja é estática e ler `searchParams` a tornaria
                dinâmica — trocaríamos uma página pronta por uma renderizada a
                cada visita, e ela é a mais visitada do site. O fragmento não
                chega ao servidor; quem o lê é o cardápio, no navegador.
              */
              href={`/loja/${item.storeSlug}#q=${encodeURIComponent(term)}`}
              className="flex gap-4 rounded-xl border border-neutral-200 bg-surface p-4 transition hover:bg-surface-hover dark:border-neutral-800"
            >
              <ItemImage item={item} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{item.name}</h3>
                  {item.discountLabel ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                      {item.discountLabel}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-medium tabular-nums">
                    {formatCents(item.priceCents)}
                  </span>
                  {item.originalCents !== null ? (
                    <span className="text-sm text-neutral-400 line-through tabular-nums">
                      {formatCents(item.originalCents)}
                    </span>
                  ) : null}
                </p>

                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {item.storeName}
                  {" · "}
                  {item.storeNeighborhood}
                  {item.storeIsOpen ? null : " · fechada"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A foto do item, a logo da loja, ou a inicial dela — nessa ordem.
 *
 * Cardápio novo entra sem foto, e uma fileira de quadrados vazios faz a busca
 * parecer um catálogo abandonado. A logo no lugar resolve dois problemas de
 * uma vez: a lista ganha cor, e o lojista vê a marca dele aparecer quando
 * alguém procura o que ele vende.
 *
 * Ela é desenhada **inteira dentro do quadro**, sobre fundo neutro, enquanto a
 * foto do prato preenche e é cortada. A diferença é de propósito: logo esticada
 * como se fosse foto de comida seria uma promessa que o pedido não cumpre.
 */
function ItemImage({ item }: { item: MatchedItem }) {
  const box =
    "relative size-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800";

  if (item.imageUrl) {
    return (
      <div className={`${box} bg-neutral-50 dark:bg-neutral-900`}>
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>
    );
  }

  if (item.storeLogoUrl) {
    return (
      <div className={`${box} bg-surface p-1.5`}>
        <Image
          src={item.storeLogoUrl}
          alt=""
          fill
          sizes="64px"
          className="object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div
      className={`${box} flex items-center justify-center bg-neutral-50 dark:bg-neutral-900`}
    >
      <span className="text-xl font-semibold text-neutral-300 dark:text-neutral-700">
        {item.storeName.charAt(0)}
      </span>
    </div>
  );
}
