"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { HouseIcon } from "@/components/house-icon";
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
  const book = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [label, setLabel] = useState("");
  const { cep, setCep, status, setStatus, submit } = useCepLookup(
    (location) => {
      savePlace(location, label);
      setLabel("");
      onClose();
      router.push(storesUrl(location));
    },
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const hasPlaces = book.places.length > 0;

  const field =
    "w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Seus endereços"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Para onde vai o pedido?</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            O endereço escolhido vale para as lojas que você vê e para a
            mensagem que chega na loja.
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

          {status === "erro" ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              CEP não encontrado
            </span>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "buscando" || cepDigits(cep).length !== 8}
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
      </div>
    </div>
  );
}
