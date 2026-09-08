"use client";

import { useState } from "react";

import { cepDigits, lookupCep } from "@/lib/cep";
import type { CustomerLocation } from "@/lib/customer-location";

/**
 * A consulta de CEP, compartilhada.
 *
 * Três telas perguntam o CEP — o campo grande da home, a barra do topo e a
 * lista de endereços — e todas fazem a mesma coisa com a resposta. Mora aqui em
 * módulo próprio, e não junto de uma delas, porque a lista importa a barra e a
 * barra importaria a lista de volta.
 */
export type LookupStatus = "idle" | "buscando" | "erro";

export function useCepLookup(onFound: (location: CustomerLocation) => void) {
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<LookupStatus>("idle");

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

    setStatus("idle");
    setCep("");

    onFound({
      cep: result.address.cep,
      street: result.address.street,
      neighborhood: result.address.neighborhood,
      city: result.address.city,
      uf: result.address.uf,
      ibge: result.address.ibge,
    });
  }

  return { cep, setCep, status, setStatus, submit };
}
