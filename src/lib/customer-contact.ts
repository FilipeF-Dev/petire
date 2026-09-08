/**
 * A chave antiga de "quem recebe e em que número".
 *
 * Isto existia sozinho enquanto o cliente tinha um endereço só: um nome, um
 * número e um complemento, guardados à parte do CEP. Com a lista de endereços
 * os três passaram a morar **dentro** de cada endereço — porque trocar de
 * endereço mantendo o número do anterior manda o pedido para a porta errada, e
 * esse é o erro mais caro que estas telas sabem cometer.
 *
 * Sobrou como fonte de migração: `customer-location.ts` lê isto uma vez, ao
 * encontrar a chave antiga, para quem já usava o Petire não perder o que tinha
 * digitado. Nada escreve aqui.
 *
 * Some quando não houver mais ninguém com a chave antiga no aparelho.
 */

const KEY = "petire.contato.v1";

export type CustomerContact = {
  /** Quem vai receber. */
  recipient: string;
  /** Número da residência. */
  number: string;
  /** Apartamento, bloco, ponto de referência. Pode ser vazio. */
  complement: string;
};

const EMPTY_CONTACT: CustomerContact = {
  recipient: "",
  number: "",
  complement: "",
};

function isContact(value: unknown): value is CustomerContact {
  if (typeof value !== "object" || value === null) return false;
  const contact = value as Record<string, unknown>;
  return (
    typeof contact.recipient === "string" &&
    typeof contact.number === "string" &&
    typeof contact.complement === "string"
  );
}

export function readContact(): CustomerContact {
  if (typeof window === "undefined") return EMPTY_CONTACT;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_CONTACT;

    const parsed: unknown = JSON.parse(raw);
    return isContact(parsed) ? parsed : EMPTY_CONTACT;
  } catch {
    return EMPTY_CONTACT;
  }
}
