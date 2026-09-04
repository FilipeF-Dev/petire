/**
 * As lojas de quem o cliente já pediu.
 *
 * Sem cadastro, o Petire some da vida do cliente no instante em que ele sai
 * para o WhatsApp — e a recompra é justamente o que faz o número do lojista
 * crescer do primeiro mês para o segundo. Esta lista é o caminho de volta
 * dentro do site, gêmea do link que vai no rodapé da mensagem.
 *
 * Fica **só no browser dele**, como o CEP e o contato, e pelo mesmo motivo: o
 * Petire não tem cadastro e não tem por que saber de quem alguém pede.
 *
 * Guarda só apelido e nome. Logo e preço não entram — a URL da foto expira e o
 * preço de ontem não vale hoje, e uma lista que mostra qualquer um dos dois
 * errado é pior do que não existir. O resto é relido do banco na página da
 * loja, como no carrinho.
 */

const KEY = "petire.pedidos.v1";

/** Quantas cabem antes de a lista virar rolagem em vez de atalho. */
const LIMIT = 4;

/**
 * A identidade do que foi pedido — a mesma coisa que o carrinho guarda, e pelo
 * mesmo motivo: preço, nome e disponibilidade são relidos do banco na hora.
 */
export type RepeatLine = {
  productId: string;
  optionIds: string[];
  quantity: number;
  note: string | null;
};

export type RecentStore = {
  slug: string;
  name: string;
  /** Epoch em ms. Ordena a lista; nada é mostrado ao cliente. */
  at: number;
  /**
   * Opcionais porque entraram depois: quem já tinha a lista guardada continua
   * com o atalho para a loja, só sem o "repetir pedido" até o próximo envio.
   */
  storeId?: string;
  lines?: RepeatLine[];
};

const EMPTY: RecentStore[] = [];

let cache: RecentStore[] | undefined;
const listeners = new Set<() => void>();

function isLine(value: unknown): value is RepeatLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === "string" &&
    Array.isArray(line.optionIds) &&
    line.optionIds.every((option) => typeof option === "string") &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}

function isStore(value: unknown): value is RecentStore {
  if (typeof value !== "object" || value === null) return false;
  const store = value as Record<string, unknown>;
  return (
    typeof store.slug === "string" &&
    store.slug !== "" &&
    typeof store.name === "string" &&
    store.name !== "" &&
    typeof store.at === "number" &&
    (store.lines === undefined ||
      (Array.isArray(store.lines) && store.lines.every(isLine)))
  );
}

function read(): RecentStore[] {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const stores = parsed.filter(isStore).sort((a, b) => b.at - a.at);
    return stores.length === 0 ? EMPTY : stores.slice(0, LIMIT);
  } catch {
    return EMPTY;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // O pedido é enviado no /carrinho e a lista aparece na home. Numa aba só o
  // React remonta e relê; o `storage` cobre a segunda aba aberta.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cache = undefined;
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
export function getSnapshot(): RecentStore[] {
  if (cache === undefined) cache = read();
  return cache;
}

export function getServerSnapshot(): RecentStore[] {
  return EMPTY;
}

/**
 * Registra que o cliente mandou um pedido para esta loja.
 *
 * Chamado no envio, não na visita: a lista responde "de onde eu já pedi", e
 * cardápio aberto por curiosidade não é pedido. Repetir a mesma loja move ela
 * para o topo em vez de duplicar.
 */
export function rememberOrder(store: {
  storeId: string;
  slug: string;
  name: string;
  lines: RepeatLine[];
}): void {
  const entry: RecentStore = {
    slug: store.slug,
    name: store.name,
    at: Date.now(),
    storeId: store.storeId,
    lines: store.lines,
  };

  const next = [
    entry,
    ...getSnapshot().filter((recent) => recent.slug !== store.slug),
  ].slice(0, LIMIT);

  cache = next;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Modo anônimo com storage bloqueado: o pedido sai igual, só não é
    // lembrado no próximo.
  }

  for (const listener of listeners) listener();
}

export function forgetOrders(): void {
  cache = EMPTY;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a fazer: já não havia como guardar.
  }
  for (const listener of listeners) listener();
}
