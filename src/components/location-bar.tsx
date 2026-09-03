"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { cepDigits, formatCep as maskCep, lookupCep } from "@/lib/cep";
import {
  formatCep,
  getServerSnapshot,
  getSnapshot,
  setLocation,
  storesUrl,
  subscribe,
  type CustomerLocation,
} from "@/lib/customer-location";

export function useCustomerLocation(): CustomerLocation | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Barra de CEP no topo do site.
 *
 * É a porta de entrada: o cliente informa o CEP uma vez, encontra as lojas da
 * cidade dele com as do bairro primeiro, e o endereço de entrega já vai
 * preenchido na mensagem do WhatsApp.
 */
export function LocationBar() {
  const location = useCustomerLocation();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<"idle" | "buscando" | "erro">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const digits = cepDigits(cep);
    if (digits.length !== 8) {
      setStatus("erro");
      return;
    }

    setStatus("buscando");
    const result = await lookupCep(digits);

    if (!result.ok) {
      setStatus("erro");
      return;
    }

    const next: CustomerLocation = {
      cep: result.address.cep,
      street: result.address.street,
      neighborhood: result.address.neighborhood,
      city: result.address.city,
      uf: result.address.uf,
      ibge: result.address.ibge,
    };

    setLocation(next);
    setStatus("idle");
    setOpen(false);
    setCep("");
    router.push(storesUrl(next));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        <span aria-hidden>📍</span>
        {location ? (
          <span className="truncate">
            {location.neighborhood || location.city}
            <span className="text-neutral-400"> · {formatCep(location.cep)}</span>
          </span>
        ) : (
          <span>Informe seu CEP</span>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 items-center gap-2">
      <input
        value={maskCep(cep)}
        onChange={(event) => {
          setCep(event.target.value);
          setStatus("idle");
        }}
        inputMode="numeric"
        autoComplete="postal-code"
        autoFocus
        aria-label="Seu CEP"
        placeholder="Seu CEP"
        className="w-32 rounded-lg border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
      />
      <button
        type="submit"
        disabled={status === "buscando"}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {status === "buscando" ? "…" : "Ver lojas"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setStatus("idle");
        }}
        className="text-sm text-neutral-500 dark:text-neutral-400"
      >
        cancelar
      </button>

      {status === "erro" ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          CEP não encontrado
        </span>
      ) : null}
    </form>
  );
}
