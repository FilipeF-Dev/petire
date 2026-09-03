/**
 * Consulta de CEP no ViaCEP.
 *
 * É o que impede que o endereço da loja dependa da digitação de quem cadastra.
 * Cidade e UF vêm sempre; o `ibge` é o código do município e serve de
 * identificador canônico da cidade.
 *
 * O bairro **não** vem sempre: cidade pequena costuma ter CEP único e o
 * ViaCEP devolve bairro e logradouro vazios. Por isso o formulário deixa o
 * bairro editável, e o agrupamento no banco é feito por coluna normalizada.
 */

export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  ibge: string;
};

export function cepDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, 8);
}

/** 05435020 → "05435-020" */
export function formatCep(input: string): string {
  const digits = cepDigits(input);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export type CepResult =
  | { ok: true; address: CepAddress }
  | { ok: false; reason: "invalido" | "nao-encontrado" | "indisponivel" };

export async function lookupCep(
  input: string,
  signal?: AbortSignal,
): Promise<CepResult> {
  const digits = cepDigits(input);
  if (digits.length !== 8) return { ok: false, reason: "invalido" };

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal,
    });
    if (!response.ok) return { ok: false, reason: "indisponivel" };

    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) {
      return { ok: false, reason: "indisponivel" };
    }

    const body = data as Record<string, unknown>;
    // CEP inexistente volta com status 200 e { erro: "true" }.
    if (body.erro) return { ok: false, reason: "nao-encontrado" };

    const text = (value: unknown) =>
      typeof value === "string" ? value.trim() : "";

    const city = text(body.localidade);
    const uf = text(body.uf);
    if (!city || !uf) return { ok: false, reason: "nao-encontrado" };

    return {
      ok: true,
      address: {
        cep: digits,
        street: text(body.logradouro),
        neighborhood: text(body.bairro),
        city,
        uf: uf.toUpperCase(),
        ibge: text(body.ibge),
      },
    };
  } catch {
    // Inclui o abort de uma consulta que foi substituída por outra.
    return { ok: false, reason: "indisponivel" };
  }
}
