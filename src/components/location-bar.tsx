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

  // Quem ainda não informou o CEP vê a caixa já aberta: um link "Informe seu
  // CEP" cobra um toque a mais para chegar no mesmo campo, e é o primeiro
  // toque de quem acabou de chegar no site.
  const [isEditing, setIsEditing] = useState(false);
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<"idle" | "buscando" | "erro">("idle");

  const showForm = location === null || isEditing;

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
    setIsEditing(false);
    setCep("");
    router.push(storesUrl(next));
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        <span aria-hidden>📍</span>
        <span className="truncate">
          {location?.neighborhood || location?.city}
          <span className="text-neutral-400">
            {" "}
            · {formatCep(location?.cep ?? "")}
          </span>
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-wrap items-center gap-2">
      <label
        htmlFor="cep-do-cliente"
        className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400"
      >
        <span aria-hidden>📍</span>
        Informe seu CEP
      </label>

      <input
        id="cep-do-cliente"
        value={maskCep(cep)}
        onChange={(event) => {
          setCep(event.target.value);
          setStatus("idle");
        }}
        inputMode="numeric"
        autoComplete="postal-code"
        // Só rouba o foco quando o cliente pediu para trocar o CEP. Aberta na
        // chegada, a caixa puxaria o teclado do celular por cima do site.
        autoFocus={isEditing}
        placeholder="00000-000"
        className="w-32 rounded-lg border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
      />
      <button
        type="submit"
        disabled={status === "buscando"}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {status === "buscando" ? "…" : "Ver lojas"}
      </button>

      {isEditing ? (
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setStatus("idle");
          }}
          className="text-sm text-neutral-500 dark:text-neutral-400"
        >
          cancelar
        </button>
      ) : null}

      {status === "erro" ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          CEP não encontrado
        </span>
      ) : null}
    </form>
  );
}
