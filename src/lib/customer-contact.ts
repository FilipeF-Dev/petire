/**
 * Quem recebe o pedido e onde, exatamente.
 *
 * O CEP dá rua, bairro e cidade; falta o que nenhum CEP sabe — o nome de quem
 * vai atender a porta, o número da casa e o complemento. É o que mais faz
 * entrega dar errado quando vem errado, e digitar isso no meio da conversa do
 * WhatsApp é onde o cliente se perde.
 *
 * Fica **só no browser dele**, como o CEP e pelo mesmo motivo: o Petire não
 * tem cadastro e não tem por que guardar nome e endereço de ninguém. Daqui a
 * informação vai para a mensagem e do aparelho dele direto para a loja.
 *
 * Guardar entre pedidos é o que faz o segundo pedido custar um toque. Chave
 * separada da do CEP de propósito: o cliente pode trocar de endereço sem
 * perder o nome, e um formato antigo de uma não estraga a leitura da outra.
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

export const EMPTY_CONTACT: CustomerContact = {
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

export function saveContact(contact: CustomerContact): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(contact));
  } catch {
    // Modo anônimo com storage bloqueado: o pedido sai igual, só não é
    // lembrado no próximo.
  }
}
