/**
 * Os endereços do cliente.
 *
 * Servem para duas coisas: encontrar as lojas da cidade dele e preencher o
 * endereço de entrega na mensagem do WhatsApp.
 *
 * Ficam **só no browser dele**. Endereço residencial é dado pessoal, e o
 * Petire não tem cadastro nem motivo para guardar isso do lado do servidor —
 * eles vão daqui direto para o WhatsApp da loja, que é quem precisa entregar.
 *
 * ---
 *
 * Por que uma lista, e não um endereço só.
 *
 * Pedir de casa é o caso que a gente imaginou; pedir do trabalho, da casa de
 * um amigo ou para entregar na casa da mãe é o resto da semana. Com um slot
 * só, cada um desses obrigava a redigitar o CEP — e, pior, a redigitar o
 * número, porque quem esquece essa parte manda o pedido para o endereço certo
 * com o número do endereço anterior.
 *
 * Por isso **o número e o complemento moram dentro de cada endereço**, e não
 * ao lado dele. Trocar de endereço troca o pacote inteiro. Um número órfão de
 * rua é o erro mais caro que esta tela sabe cometer: o pedido sai, a loja
 * entrega, e ninguém descobre até bater na porta errada.
 */

import { readContact } from "./customer-contact";
import { slugify } from "./slug";

const KEY = "petire.enderecos.v1";

/** A chave antiga, de quando havia um endereço só. Lida uma vez, na migração. */
const LEGACY_KEY = "petire.local.v1";

/** Acima disso a lista deixa de ser um atalho e vira uma tela para ler. */
const MAX_PLACES = 5;

/** O que o CEP resolve. */
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

/** O que nenhum CEP sabe, e que muda de um endereço para o outro. */
export type PlaceContact = {
  /** Quem vai receber. */
  recipient: string;
  /** Número da residência. */
  number: string;
  /** Apartamento, bloco, ponto de referência. Pode ser vazio. */
  complement: string;
};

export type SavedPlace = CustomerLocation &
  PlaceContact & {
    id: string;
    /**
     * "Casa", "Trabalho". Vazio no primeiro endereço de propósito: quem está
     * chegando quer ver as lojas, não batizar coisas. O apelido só é pedido
     * quando existe um segundo, que é quando ele passa a distinguir algo.
     */
    label: string;
  };

export type AddressBook = {
  places: SavedPlace[];
  activeId: string | null;
};

const EMPTY: AddressBook = { places: [], activeId: null };

let cache: AddressBook | undefined;
const listeners = new Set<() => void>();

function isPlace(value: unknown): value is SavedPlace {
  if (typeof value !== "object" || value === null) return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    place.id !== "" &&
    typeof place.cep === "string" &&
    /^[0-9]{8}$/.test(place.cep) &&
    typeof place.city === "string" &&
    place.city !== "" &&
    typeof place.neighborhood === "string" &&
    typeof place.street === "string" &&
    typeof place.uf === "string" &&
    typeof place.ibge === "string" &&
    typeof place.label === "string" &&
    typeof place.recipient === "string" &&
    typeof place.number === "string" &&
    typeof place.complement === "string"
  );
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Navegador antigo, ou contexto sem crypto: o id só precisa ser único
    // dentro desta lista de no máximo cinco.
    return `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Traz quem já usava o Petire antes da lista existir.
 *
 * O endereço e o contato viviam em duas chaves separadas, e eram um só de cada.
 * Viram o primeiro item da lista, sem apelido — exatamente o estado em que a
 * pessoa estava.
 */
function migrateLegacy(): AddressBook {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return EMPTY;

    const old: unknown = JSON.parse(raw);
    if (typeof old !== "object" || old === null) return EMPTY;

    const location = old as Record<string, unknown>;
    if (typeof location.cep !== "string" || !/^[0-9]{8}$/.test(location.cep)) {
      return EMPTY;
    }

    const contact = readContact();

    const place: SavedPlace = {
      id: newId(),
      label: "",
      cep: location.cep,
      street: typeof location.street === "string" ? location.street : "",
      neighborhood:
        typeof location.neighborhood === "string" ? location.neighborhood : "",
      city: typeof location.city === "string" ? location.city : "",
      uf: typeof location.uf === "string" ? location.uf : "",
      ibge: typeof location.ibge === "string" ? location.ibge : "",
      recipient: contact.recipient,
      number: contact.number,
      complement: contact.complement,
    };

    if (place.city === "") return EMPTY;

    const book: AddressBook = { places: [place], activeId: place.id };
    persist(book);
    return book;
  } catch {
    return EMPTY;
  }
}

function read(): AddressBook {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return migrateLegacy();

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;

    const book = parsed as Record<string, unknown>;
    const places = Array.isArray(book.places)
      ? book.places.filter(isPlace).slice(0, MAX_PLACES)
      : [];

    if (places.length === 0) return EMPTY;

    // Ativo que aponta para um endereço apagado deixaria o cliente sem nenhum
    // selecionado, com a lista cheia.
    const activeId =
      typeof book.activeId === "string" &&
      places.some((place) => place.id === book.activeId)
        ? book.activeId
        : places[0].id;

    return { places, activeId };
  } catch {
    return EMPTY;
  }
}

function persist(book: AddressBook): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    // Modo anônimo com storage bloqueado: vale só nesta aba.
  }
}

function commit(book: AddressBook): void {
  cache = book;
  persist(book);
  for (const listener of listeners) listener();
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
export function getSnapshot(): AddressBook {
  if (cache === undefined) cache = read();
  return cache;
}

export function getServerSnapshot(): AddressBook {
  return EMPTY;
}

/** O endereço em uso agora, ou nulo quando ainda não há nenhum. */
export function activePlace(book: AddressBook): SavedPlace | null {
  return book.places.find((place) => place.id === book.activeId) ?? null;
}

/**
 * Guarda um endereço vindo do CEP e passa a usá-lo.
 *
 * Mesmo CEP **com o mesmo apelido** é o mesmo endereço: o cliente está
 * corrigindo, não criando outro. Mesmo CEP com apelido diferente é entrada
 * nova de propósito — cidade pequena tem CEP único, então casa e trabalho
 * dividem o CEP e só o apelido, o número e o complemento os distinguem.
 */
export function savePlace(
  location: CustomerLocation,
  label = "",
  contact: PlaceContact = { recipient: "", number: "", complement: "" },
): void {
  const book = getSnapshot();
  const clean = label.trim();

  const existing = book.places.find(
    (place) => place.cep === location.cep && place.label === clean,
  );

  if (existing) {
    const updated: SavedPlace = { ...existing, ...location };
    commit({
      places: book.places.map((place) =>
        place.id === existing.id ? updated : place,
      ),
      activeId: existing.id,
    });
    return;
  }

  const place: SavedPlace = {
    ...location,
    ...contact,
    id: newId(),
    label: clean,
  };

  // No teto, o mais antigo que não está em uso sai. Recusar o endereço novo
  // seria pedir que o cliente fosse limpar uma lista para conseguir pedir.
  const places = [...book.places, place];
  if (places.length > MAX_PLACES) {
    const victim = places.find(
      (candidate) => candidate.id !== book.activeId && candidate.id !== place.id,
    );
    if (victim) places.splice(places.indexOf(victim), 1);
  }

  commit({ places: places.slice(-MAX_PLACES), activeId: place.id });
}

export function setActivePlace(id: string): void {
  const book = getSnapshot();
  if (!book.places.some((place) => place.id === id)) return;
  commit({ ...book, activeId: id });
}

export function removePlace(id: string): void {
  const book = getSnapshot();
  const places = book.places.filter((place) => place.id !== id);

  commit({
    places,
    activeId:
      book.activeId === id ? (places[0]?.id ?? null) : book.activeId,
  });
}

/**
 * Quem recebe e em que número, no endereço em uso.
 *
 * Fica junto do endereço, e não numa chave à parte, porque número sem rua é o
 * erro que faz a loja entregar no lugar errado.
 */
export function readActiveContact(): PlaceContact {
  const place = activePlace(getSnapshot());
  if (!place) return { recipient: "", number: "", complement: "" };

  return {
    recipient: place.recipient,
    number: place.number,
    complement: place.complement,
  };
}

export function saveActiveContact(contact: PlaceContact): void {
  const book = getSnapshot();
  if (!book.activeId) return;

  commit({
    ...book,
    places: book.places.map((place) =>
      place.id === book.activeId ? { ...place, ...contact } : place,
    ),
  });
}

/** O nome curto do endereço na barra e na lista. */
export function placeLabel(place: SavedPlace): string {
  return place.label || place.neighborhood || place.city;
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
