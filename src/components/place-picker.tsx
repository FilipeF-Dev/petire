"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { HouseIcon } from "@/components/house-icon";
import { Modal } from "@/components/modal";
import { useCepLookup } from "@/components/use-cep-lookup";
import { cepDigits, formatCep as maskCep } from "@/lib/cep";
import {
  formatCep,
  getServerSnapshot,
  getSnapshot,
  placeLabel,
  removePlace,
  savePlace,
  setActivePlace,
  storesUrl,
  subscribe,
} from "@/lib/customer-location";

/**
 * A lista de endereços do cliente.
 *
 * Quem pede sempre do mesmo lugar nunca vê esta tela: com um endereço só, a
 * barra do topo continua sendo um rótulo com "trocar". Ela existe para o resto
 * da semana — o pedido do trabalho, o da casa de um amigo, o que vai para a
 * casa da mãe.
 *
 * O apelido só é pedido a partir do segundo endereço. No primeiro ele não
 * distingue nada, e batizar coisas é a última vontade de quem acabou de chegar
 * e quer ver as lojas.
 */
export function PlacePicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const book = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [recipient, setRecipient] = useState("");

  const { cep, setCep, status, setStatus, submit } = useCepLookup(
    (location) => {
      savePlace(location, label, {
        recipient: recipient.trim(),
        number: number.trim(),
        complement: complement.trim(),
      });
      setLabel("");
      setNumber("");
      setComplement("");
      setRecipient("");
      onClose();
      router.push(storesUrl(location));
    },
  );

  const hasPlaces = book.places.length > 0;

  const field =
    "w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300";

  return (
    <Modal label="Seus endereços" onClose={onClose}>
      <div>
        <h2 className="text-lg font-semibold">Para onde vai o pedido?</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          O endereço escolhido vale para as lojas que você vê e para a mensagem
          que chega na loja.
        </p>
      </div>

      {hasPlaces ? (
        <ul className="flex flex-col gap-2">
          {book.places.map((place) => {
            const isActive = place.id === book.activeId;

            return (
              <li key={place.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePlace(place.id);
                    onClose();
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-neutral-900 px-4 py-3 text-left text-sm dark:border-neutral-100"
                      : "flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm transition hover:bg-surface-hover dark:border-neutral-800"
                  }
                >
                  <HouseIcon className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {placeLabel(place)}
                    </span>
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {place.street ? `${place.street} · ` : null}
                      {formatCep(place.cep)}
                      {place.number ? ` · nº ${place.number}` : null}
                    </span>
                  </span>
                </button>

                {/* Some quando só resta um: apagar o último deixaria o
                      cliente sem endereço nenhum, na tela de trocar endereço. */}
                {book.places.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removePlace(place.id)}
                    aria-label={`Remover ${placeLabel(place)}`}
                    className="shrink-0 px-2 text-xs text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
                  >
                    remover
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"
      >
        <p className="text-sm font-medium">
          {hasPlaces ? "Adicionar outro endereço" : "Informe seu CEP"}
        </p>

        {/* O apelido só aparece a partir do segundo: antes disso ele não
              distingue nada. E em cidade de CEP único é ele que separa casa de
              trabalho, porque o CEP é o mesmo nos dois. */}
        {hasPlaces ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Apelido{" "}
              <span className="text-neutral-500 dark:text-neutral-400">
                (opcional)
              </span>
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={20}
              placeholder="Trabalho"
              className={field}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            CEP
          </span>
          <input
            value={maskCep(cep)}
            onChange={(event) => {
              setCep(event.target.value);
              setStatus("idle");
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            className={`${field} tabular-nums`}
          />
        </label>

        {/*
            O número entra aqui e não só no fechamento do pedido: endereço sem
            número não é endereço, e é o que o entregador precisa. Perguntado
            agora, o pedido seguinte não pergunta mais nada — o pop-up do
            carrinho vira conferência em vez de formulário.

            O campo grande da home continua pedindo só o CEP, de propósito:
            quem está chegando quer ver se existe lanchonete no bairro, e
            cobrar número antes disso é pedir compromisso antes de entregar
            valor. Quem entra por lá completa no primeiro pedido.
          */}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Número
            </span>
            <input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="120"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Complemento{" "}
              <span className="text-neutral-500 dark:text-neutral-400">
                (opcional)
              </span>
            </span>
            <input
              value={complement}
              onChange={(event) => setComplement(event.target.value)}
              maxLength={80}
              placeholder="Apto 42, portão azul"
              className={field}
            />
          </label>
        </div>

        {/* Opcional: em "Casa" quem recebe é sempre você, mas em "Casa da
              mãe" não. Vazio aqui só faz o pop-up do carrinho perguntar uma
              vez, e a resposta fica salva neste endereço. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Quem recebe{" "}
            <span className="text-neutral-500 dark:text-neutral-400">
              (opcional)
            </span>
          </span>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            maxLength={80}
            placeholder="Seu nome"
            className={field}
          />
        </label>

        {status === "erro" ? (
          <span className="text-xs text-red-600 dark:text-red-400">
            CEP não encontrado
          </span>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              status === "buscando" ||
              cepDigits(cep).length !== 8 ||
              number.trim() === ""
            }
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {status === "buscando" ? "Buscando…" : "Usar este endereço"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700"
          >
            Fechar
          </button>
        </div>
      </form>
    </Modal>
  );
}
