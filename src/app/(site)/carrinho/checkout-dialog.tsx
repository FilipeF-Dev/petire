"use client";

import { useEffect, useState } from "react";

import {
  readActiveContact,
  saveActiveContact,
  type PlaceContact,
} from "@/lib/customer-location";
import type { Delivery } from "@/lib/order-message";

/**
 * O último passo antes do WhatsApp.
 *
 * Tem dois modos, e qual deles aparece depende de quanto o endereço já sabe:
 *
 * **Conferência**, quando o endereço está completo. Não pergunta nada — mostra
 * como a entrega vai escrita na mensagem, com um "editar" ao lado. É o caso de
 * quem cadastrou o endereço inteiro na lista, e faz o segundo pedido custar um
 * toque de verdade.
 *
 * **Formulário**, quando falta o número ou quem recebe. É o caso de quem entrou
 * pelo campo grande da home, que pede só o CEP de propósito. A resposta fica
 * salva no endereço e ele não volta a perguntar.
 *
 * O pop-up não deixa de existir quando não há o que perguntar, e isso é
 * deliberado: enviar é uma ação para fora, para um negócio de verdade, e o
 * endereço pode ter sido salvo há três semanas. É o mesmo motivo de o carrinho
 * reler o preço em vez de confiar no que guardou.
 *
 * O que o cliente digita fica no aparelho dele (ver
 * src/lib/customer-location.ts), junto do endereço a que pertence e não numa
 * gaveta separada: número sem rua entrega no lugar errado.
 */
export function CheckoutDialog({
  storeName,
  address,
  onCancel,
  onConfirm,
}: {
  storeName: string;
  /** Endereço vindo do CEP. Nulo quando o cliente não informou nenhum. */
  address: Omit<Delivery, "recipient" | "number" | "complement"> | null;
  onCancel: () => void;
  onConfirm: (contact: PlaceContact) => void;
}) {
  const [contact, setContact] = useState<PlaceContact>(readActiveContact);
  const [touched, setTouched] = useState(false);

  // Começa conferindo quando já há o que conferir. Só o cliente troca de modo,
  // e num sentido só: uma vez em edição, o formulário fica.
  const [isEditing, setIsEditing] = useState(
    () =>
      contact.recipient.trim() === "" ||
      contact.number.trim() === "" ||
      address === null,
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  const recipient = contact.recipient.trim();
  const number = contact.number.trim();
  const isValid = recipient !== "" && number !== "";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;

    const clean: PlaceContact = {
      recipient,
      number,
      complement: contact.complement.trim(),
    };

    saveActiveContact(clean);
    onConfirm(clean);
  }

  const field =
    "w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Dados da entrega — ${storeName}`}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Para onde vai o pedido?</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Vai escrito na mensagem para {storeName}.
          </p>
        </div>

        {/* Conferência: o endereço inteiro do jeito que a loja vai ler. */}
        {!isEditing && address ? (
          <div className="rounded-lg bg-background p-3 text-sm">
            <p className="font-medium">
              {address.street ? `${address.street}, ` : null}nº {number}
              {contact.complement.trim()
                ? ` — ${contact.complement.trim()}`
                : null}
            </p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              {address.neighborhood ? `${address.neighborhood} · ` : null}
              {address.city}/{address.uf}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-neutral-600 dark:text-neutral-400">
              <span>{recipient} recebe</span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="underline underline-offset-4"
              >
                editar
              </button>
            </p>
          </div>
        ) : null}

        {isEditing ? (
          <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Quem vai receber</span>
            <input
              value={contact.recipient}
              onChange={(event) =>
                setContact({ ...contact, recipient: event.target.value })
              }
              autoFocus
              maxLength={80}
              placeholder="Seu nome"
              className={field}
            />
            {touched && recipient === "" ? (
              <span className="text-xs text-red-600 dark:text-red-400">
                Informe quem vai receber.
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Número</span>
              <input
                value={contact.number}
                onChange={(event) =>
                  setContact({ ...contact, number: event.target.value })
                }
                inputMode="numeric"
                maxLength={10}
                placeholder="120"
                className={field}
              />
              {touched && number === "" ? (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Informe o número.
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Complemento{" "}
                <span className="font-normal text-neutral-500 dark:text-neutral-400">
                  (opcional)
                </span>
              </span>
              <input
                value={contact.complement}
                onChange={(event) =>
                  setContact({ ...contact, complement: event.target.value })
                }
                maxLength={80}
                placeholder="Apto 42, fundos, portão azul"
                className={field}
              />
            </label>
          </div>

          {address ? (
            <p className="rounded-lg bg-background p-3 text-sm text-neutral-600 dark:text-neutral-400">
              {address.street ? `${address.street} · ` : null}
              {address.neighborhood ? `${address.neighborhood} · ` : null}
              {address.city}/{address.uf}
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Sem CEP informado, a rua não vai na mensagem — a loja vai ter de
              perguntar.
            </p>
          )}
          </>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700"
          >
            Enviar no WhatsApp
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
