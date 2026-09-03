"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { HouseIcon } from "@/components/house-icon";
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
 * O CEP é a porta de entrada do site: encontra as lojas da cidade e preenche o
 * endereço de entrega na mensagem do WhatsApp. A mesma lógica serve os dois
 * lugares que perguntam — o campo grande da home e a barra do topo — e por
 * isso mora aqui uma vez só.
 */
function useCepLookup(onDone: () => void) {
  const router = useRouter();
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
    setCep("");
    onDone();
    router.push(storesUrl(next));
  }

  return { cep, setCep, status, setStatus, submit };
}

function ErrorHint({ status }: { status: "idle" | "buscando" | "erro" }) {
  if (status !== "erro") return null;
  return (
    <span className="text-xs text-red-600 dark:text-red-400">
      CEP não encontrado
    </span>
  );
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
  const location = useCustomerLocation();
  const [isEditing, setIsEditing] = useState(false);
  const { cep, setCep, status, setStatus, submit } = useCepLookup(() =>
    setIsEditing(false),
  );

  if (location && !isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-base">
          <HouseIcon />
          <span>
            {location.neighborhood || location.city}
            <span className="text-neutral-500 dark:text-neutral-400">
              {" · "}
              {formatCep(location.cep)}
            </span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-sm text-neutral-500 underline underline-offset-4 dark:text-neutral-400"
        >
          trocar
        </button>
      </div>
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

        {location ? (
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
      </div>

      <ErrorHint status={status} />
    </form>
  );
}

/**
 * A barra de CEP do topo, que acompanha o cliente pelo site inteiro.
 *
 * Ela se cala na home enquanto não há CEP: lá o campo grande já faz a
 * pergunta, e dois campos pedindo a mesma coisa na mesma tela só criam a
 * dúvida de qual dos dois vale.
 */
export function LocationBar() {
  const location = useCustomerLocation();
  const pathname = usePathname();

  const [isEditing, setIsEditing] = useState(false);
  const { cep, setCep, status, setStatus, submit } = useCepLookup(() =>
    setIsEditing(false),
  );

  if (!location && pathname === "/") return null;

  if (location && !isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        <HouseIcon className="size-4" />
        <span className="truncate">
          {location.neighborhood || location.city}
          <span className="text-neutral-400">
            {" · "}
            {formatCep(location.cep)}
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
        <HouseIcon className="size-4" />
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
        className="w-32 rounded-lg border border-neutral-300 bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
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

      <ErrorHint status={status} />
    </form>
  );
}
