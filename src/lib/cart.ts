/**
 * Carrinho do cliente.
 *
 * Fica só no localStorage do browser: o Petire não tem cadastro, então não há
 * onde guardar isso do lado do servidor nem por quê.
 *
 * O que é guardado é a *identidade* do pedido — qual produto, quais opções,
 * quantas unidades — e nunca preço, nome de loja ou número de WhatsApp. Esses
 * são relidos do banco na hora de mostrar o carrinho. Um carrinho aberto ontem
 * não pode mandar o pedido para um número que a loja já trocou, nem cobrar um
 * preço que já mudou.
 */

const KEY = "petire.cart.v1";

export type CartLine = {
  /** Derivado do conteúdo: a mesma combinação soma quantidade em vez de duplicar. */
  id: string;
  storeId: string;
  productId: string;
  optionIds: string[];
  quantity: number;
  note: string | null;
};

export function lineId(
  productId: string,
  optionIds: string[],
  note: string | null,
): string {
  return `${productId}|${[...optionIds].sort().join(",")}|${note ?? ""}`;
}

// -----------------------------------------------------------------------------
// Store observável, para o useSyncExternalStore
// -----------------------------------------------------------------------------

const EMPTY: CartLine[] = [];

let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.storeId === "string" &&
    typeof line.productId === "string" &&
    Array.isArray(line.optionIds) &&
    line.optionIds.every((option) => typeof option === "string") &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}

function read(): CartLine[] {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    // O conteúdo é editável pelo usuário e sobrevive a mudanças de versão.
    // Linha malformada é descartada em silêncio — melhor perder um item do
    // que quebrar o carrinho inteiro.
    return parsed.filter(isCartLine);
  } catch {
    return EMPTY;
  }
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Modo anônimo com storage bloqueado: o carrinho vive só nesta aba.
  }
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Carrinho aberto em duas abas precisa convergir.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Precisa devolver a mesma referência entre chamadas, ou o React entra em loop. */
export function getSnapshot(): CartLine[] {
  cache ??= read();
  return cache;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

// -----------------------------------------------------------------------------
// Operações
// -----------------------------------------------------------------------------

export function addToCart(line: Omit<CartLine, "id">): void {
  const id = lineId(line.productId, line.optionIds, line.note);
  const lines = getSnapshot();
  const existing = lines.find((item) => item.id === id);

  write(
    existing
      ? lines.map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + line.quantity }
            : item,
        )
      : [...lines, { ...line, id }],
  );
}

export function setQuantity(id: string, quantity: number): void {
  const lines = getSnapshot();
  write(
    quantity <= 0
      ? lines.filter((line) => line.id !== id)
      : lines.map((line) => (line.id === id ? { ...line, quantity } : line)),
  );
}

export function removeLine(id: string): void {
  write(getSnapshot().filter((line) => line.id !== id));
}

/**
 * Esvazia só o que é daquela loja.
 *
 * O cliente pode ter montado pedidos de duas lojas na mesma visita, e cada um
 * vai para um WhatsApp diferente. Enviar o da lanchonete não pode levar junto
 * o da distribuidora.
 */
export function clearStore(storeId: string): void {
  write(getSnapshot().filter((line) => line.storeId !== storeId));
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
