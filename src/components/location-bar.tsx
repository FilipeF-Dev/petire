"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { HouseIcon } from "@/components/house-icon";
import { PlacePicker } from "@/components/place-picker";
import { useCepLookup } from "@/components/use-cep-lookup";
import { formatCep as maskCep } from "@/lib/cep";
import {
  activePlace,
  formatCep,
  getServerSnapshot,
  getSnapshot,
  placeLabel,
  savePlace,
  storesUrl,
  subscribe,
  type CustomerLocation,
} from "@/lib/customer-location";

export function useAddressBook() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * O endereço em uso agora.
 *
 * O resto do site — a ordenação da lista e o endereço na mensagem do WhatsApp —
 * continua perguntando por um endereço só, e é este. A lista existe para o
 * cliente trocar qual é; quem consome não precisa saber que há mais de um.
 */
export function useCustomerLocation(): CustomerLocation | null {
  return activePlace(useAddressBook());
}

/**
 * O campo de CEP em destaque, na home.
 *
 * A home pedia o bairro numa lista, e bairro sem CEP resolve metade do
 * problema: encontra a loja, mas não preenche o endereço da entrega — e o
 * cliente teria de informar o CEP no passo seguinte de qualquer jeito. Uma
 * pergunta só, no lugar mais visível da página.
 */
export function LocationHero() {
  const router = useRouter();
  const book = useAddressBook();
  const place = activePlace(book);

  const [isPicking, setIsPicking] = useState(false);
  const { cep, setCep, status, setStatus, submit } = useCepLookup(
    (location) => {
      savePlace(location);
      router.push(storesUrl(location));
    },
  );

  if (place) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="flex items-center gap-2 text-base">
              <HouseIcon />
              <span>
                {placeLabel(place)}
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" · "}
                  {formatCep(place.cep)}
                </span>
              </span>
            </p>
            <button
              type="button"
              onClick={() => setIsPicking(true)}
              className="text-sm text-neutral-500 underline underline-offset-4 dark:text-neutral-400"
            >
              {book.places.length > 1 ? "trocar endereço" : "trocar"}
            </button>
          </div>

          {/*
            Quem volta ao Petire já tem endereço, e a home passava a ser uma
            tela sem saída: o CEP estava lá, mas a única forma de chegar às
            lojas era o "Lojas" do topo — que não parece o caminho, porque a
            pergunta da tela é sobre endereço, não sobre navegação.

            Na primeira visita este botão não existe: lá o "Ver lojas" já está
            colado no campo de CEP, e é o mesmo destino.
          */}
          <Link
            href={storesUrl(place)}
            className="inline-flex w-fit items-center justify-center rounded-lg bg-brand px-5 py-3 font-medium text-white transition hover:opacity-90"
          >
            Ver lojas que entregam aqui
          </Link>
        </div>

        {isPicking ? (
          <PlacePicker onClose={() => setIsPicking(false)} />
        ) : null}
      </>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label
        htmlFor="cep-hero"
        className="flex items-center gap-2 text-base font-medium"
      >
        <HouseIcon />
        Informe seu CEP para ver as lojas
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="cep-hero"
          value={maskCep(cep)}
          onChange={(event) => {
            setCep(event.target.value);
            setStatus("idle");
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          className="w-40 rounded-lg border border-neutral-300 bg-surface px-4 py-3 text-lg tabular-nums outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
        />
        <button
          type="submit"
          disabled={status === "buscando"}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {status === "buscando" ? "Buscando…" : "Ver lojas"}
        </button>
      </div>

      {status === "erro" ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          CEP não encontrado
        </span>
      ) : null}
    </form>
  );
}

/**
 * A barra de endereço do topo, que acompanha o cliente pelo site inteiro.
 *
 * Ela se cala na home enquanto não há endereço: lá o campo grande já faz a
 * pergunta, e dois campos pedindo a mesma coisa na mesma tela só criam a
 * dúvida de qual dos dois vale.
 *
 * Com endereço, é um rótulo que abre a lista. Antes ela virava um campo de CEP
 * ali mesmo — o que funcionava para corrigir um endereço e não para escolher
 * entre dois.
 */
export function LocationBar() {
  const book = useAddressBook();
  const place = activePlace(book);
  const pathname = usePathname();

  const [isPicking, setIsPicking] = useState(false);

  if (!place && pathname === "/") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPicking(true)}
        className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        <HouseIcon className="size-4" />
        <span className="truncate">
          {place ? (
            <>
              {placeLabel(place)}
              <span className="text-neutral-400">
                {" · "}
                {formatCep(place.cep)}
              </span>
            </>
          ) : (
            "Informe seu CEP"
          )}
        </span>
      </button>

      {isPicking ? <PlacePicker onClose={() => setIsPicking(false)} /> : null}
    </>
  );
}
