"use client";

import { useEffect, useState } from "react";

import { Field, inputClass } from "@/components/ui";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";

export type AddressValue = {
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  uf: string;
  ibge: string;
};

type Status =
  | "buscando"
  | "ok"
  | "sem-bairro"
  | "nao-encontrado"
  | "indisponivel";

const EMPTY: AddressValue = {
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  uf: "",
  ibge: "",
};

/**
 * Bloco de endereço com busca por CEP.
 *
 * Os campos ficam editáveis mesmo depois da busca: cidade pequena tem CEP
 * único e volta sem bairro nem logradouro, então quem cadastra precisa poder
 * completar. Cidade e UF ficam travadas porque vêm do CEP e são o que agrupa
 * as lojas — deixar editar é reabrir a porta para "São Paulo" e "Sao Paulo"
 * virarem duas cidades.
 */
export function AddressFields({
  initial,
  errors,
}: {
  initial?: Partial<AddressValue>;
  errors?: Record<string, string>;
}) {
  const [value, setValue] = useState<AddressValue>({ ...EMPTY, ...initial });

  // Guarda para qual CEP o resultado vale. Assim o estado da busca é derivado
  // do que está digitado agora, e não sobra uma mensagem de um CEP anterior.
  const [lookup, setLookup] = useState<{ cep: string; result: Status } | null>(
    initial?.city && initial.cep
      ? { cep: cepDigits(initial.cep), result: "ok" }
      : null,
  );

  const digits = cepDigits(value.cep);

  useEffect(() => {
    if (digits.length !== 8) return;

    const controller = new AbortController();

    lookupCep(digits, controller.signal).then((response) => {
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setLookup({
          cep: digits,
          result:
            response.reason === "nao-encontrado"
              ? "nao-encontrado"
              : "indisponivel",
        });
        return;
      }

      const { address } = response;
      setValue((current) => ({
        ...current,
        city: address.city,
        uf: address.uf,
        ibge: address.ibge,
        // Não sobrescreve o que já foi digitado à mão.
        neighborhood: address.neighborhood || current.neighborhood,
        address: address.street || current.address,
      }));
      setLookup({
        cep: digits,
        result: address.neighborhood ? "ok" : "sem-bairro",
      });
    });

    return () => controller.abort();
  }, [digits]);

  const status: Status | null =
    digits.length !== 8
      ? null
      : lookup?.cep === digits
        ? lookup.result
        : "buscando";

  const set = (field: keyof AddressValue) => (next: string) =>
    setValue((current) => ({ ...current, [field]: next }));

  const message =
    status === null
      ? null
      : {
          buscando: "Buscando…",
          ok: null,
          "sem-bairro":
            "Este CEP atende a cidade inteira, então não veio bairro. Escreva o bairro abaixo.",
          "nao-encontrado": "CEP não encontrado. Confira os números.",
          indisponivel:
            "A consulta de CEP falhou. Você pode preencher cidade e bairro à mão.",
        }[status];

  const manual = status === "nao-encontrado" || status === "indisponivel";

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="ibgeCode" value={value.ibge} />
      <input type="hidden" name="stateUf" value={value.uf} />

      <Field
        label="CEP da loja"
        hint="Preenche cidade e endereço sozinho."
        error={errors?.cep}
      >
        <input
          name="cep"
          value={formatCep(value.cep)}
          onChange={(event) => set("cep")(event.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="36030-000"
          className={inputClass}
        />
      </Field>

      {message ? (
        <p
          className={
            status === "nao-encontrado" || status === "indisponivel"
              ? "-mt-2 text-sm text-amber-700 dark:text-amber-400"
              : "-mt-2 text-sm text-neutral-500 dark:text-neutral-400"
          }
        >
          {message}
        </p>
      ) : null}

      <Field label="Endereço" error={errors?.address}>
        <input
          name="address"
          value={value.address}
          onChange={(event) => set("address")(event.target.value)}
          maxLength={200}
          placeholder="Rua Rodesia, 120"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Bairro"
          hint={status === "sem-bairro" ? "Escreva o bairro." : undefined}
          error={errors?.neighborhood}
        >
          <input
            name="neighborhood"
            value={value.neighborhood}
            onChange={(event) => set("neighborhood")(event.target.value)}
            required
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field label="Cidade" error={errors?.city}>
          <input
            name="city"
            value={value.city}
            onChange={(event) => set("city")(event.target.value)}
            required
            readOnly={!manual}
            maxLength={80}
            placeholder={manual ? "Juiz de Fora" : "vem do CEP"}
            className={`${inputClass} ${manual ? "" : "text-neutral-500 dark:text-neutral-400"}`}
          />
        </Field>
      </div>
    </div>
  );
}
