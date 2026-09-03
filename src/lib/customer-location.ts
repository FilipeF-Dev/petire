/**
 * O CEP do cliente.
 *
 * Serve para duas coisas: encontrar as lojas da cidade dele e preencher o
 * endereço de entrega na mensagem do WhatsApp.
 *
 * Fica **só no browser dele**. Endereço residencial é dado pessoal, e o
 * Petire não tem cadastro nem motivo para guardar isso do lado do servidor —
 * ele vai daqui direto para o WhatsApp da loja, que é quem precisa entregar.
 */

import { slugify } from "./slug";

const KEY = "petire.local.v1";

export type CustomerLocation = {
  /** Só dígitos. */
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  /** Código do município no IBGE. */
  ibge: string;
};

const EMPTY: CustomerLocation | null = null;

let cache: CustomerLocation | null | undefined;
const listeners = new Set<() => void>();

function isLocation(value: unknown): value is CustomerLocation {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.cep === "string" &&
    /^[0-9]{8}$/.test(l.cep) &&
    typeof l.city === "string" &&
    l.city !== "" &&
    typeof l.neighborhood === "string" &&
    typeof l.street === "string" &&
    typeof l.uf === "string" &&
    typeof l.ibge === "string"
  );
}

function read(): CustomerLocation | null {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isLocation(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

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
export function getSnapshot(): CustomerLocation | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function getServerSnapshot(): CustomerLocation | null {
  return EMPTY;
}

export function setLocation(location: CustomerLocation | null): void {
  cache = location;
  try {
    if (location) window.localStorage.setItem(KEY, JSON.stringify(location));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Modo anônimo com storage bloqueado: vale só nesta aba.
  }
  for (const listener of listeners) listener();
}

/**
 * Para onde mandar o cliente depois que ele informa o CEP.
 *
 * Filtra pela **cidade**, não pelo bairro. Numa cidade média, a lanchonete do
 * Centro entrega no bairro vizinho sem pensar duas vezes — casar bairro com
 * bairro mostraria "nenhuma loja" e o cliente não voltaria. O bairro entra
 * como `perto`, que só ordena.
 */
export function storesUrl(location: CustomerLocation): string {
  const params = new URLSearchParams({ cidade: slugify(location.city) });
  if (location.neighborhood) {
    params.set("perto", slugify(location.neighborhood));
  }
  return `/lojas?${params.toString()}`;
}

/** "36030330" → "36030-330" */
export function formatCep(cep: string): string {
  return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}
