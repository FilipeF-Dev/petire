import { z } from "zod";

import { parseToCents } from "./money";
import { slugify } from "./slug";

/**
 * Estado que toda Server Action de formulário devolve para o `useActionState`.
 * `fieldErrors` é mapeado por nome do campo, igual ao `name` do input.
 */
export type FormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  /** Muda a cada gravação bem-sucedida, para o formulário saber que pode limpar. */
  savedAt?: number;
  /**
   * O que foi enviado, devolvido para o formulário se reconstruir.
   *
   * O React 19 reseta campos não-controlados quando a action termina — inclusive
   * quando ela termina em erro de validação. Sem devolver os valores, uma
   * vírgula errada no preço apaga tudo que a pessoa acabou de digitar.
   * Como o reset leva o campo de volta ao `defaultValue`, basta o formulário
   * ler daqui.
   */
  values?: Record<string, string>;
};

export const emptyFormState: FormState = { error: null };

/** Só os campos de texto: arquivo não volta para o formulário. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** Converte os issues do zod no formato que os formulários consomem. */
export function toFormState(
  error: z.ZodError,
  values?: Record<string, string>,
): FormState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { error: "Confira os campos destacados.", fieldErrors, values };
}

// -----------------------------------------------------------------------------
// Tipos reutilizados
// -----------------------------------------------------------------------------

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} é obrigatório.`)
    .max(max, `${label} passou de ${max} caracteres.`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Passou de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

/** Aceita "24,90", "R$ 24,90" ou "24.90" e devolve centavos. */
const money = (label: string) =>
  z.string().transform((value, ctx) => {
    const cents = parseToCents(value);

    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `${label} inválido.` });
      return z.NEVER;
    }
    if (cents < 0) {
      ctx.addIssue({
        code: "custom",
        message: `${label} não pode ser negativo.`,
      });
      return z.NEVER;
    }
    if (cents > 99_999_99) {
      ctx.addIssue({ code: "custom", message: `${label} alto demais.` });
      return z.NEVER;
    }

    return cents;
  });

/** Só dígitos. Vazio vira null — loja cadastrada antes do CEP existir. */
const cepField = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value === "" || value.length === 8, "CEP inválido.")
  .transform((value) => (value === "" ? null : value));

const ufField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toUpperCase()))
  .refine((value) => value === null || /^[A-Z]{2}$/.test(value), "UF inválida.");

/** Código do município no IBGE, como o ViaCEP devolve. */
const ibgeField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || /^[0-9]{7}$/.test(value),
    "Código do município inválido.",
  );

const uuid = z.uuid("Identificador inválido.");

const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "Identificador inválido.",
  );

// -----------------------------------------------------------------------------
// Categoria
// -----------------------------------------------------------------------------

export const categorySchema = z.object({
  name: requiredText("Nome da categoria", 60),
});

// -----------------------------------------------------------------------------
// Produto
// -----------------------------------------------------------------------------

export const productSchema = z.object({
  name: requiredText("Nome do produto"),
  description: optionalText(500),
  price: money("Preço"),
  categoryId: optionalUuid,
  imageUrl: optionalText(600),
  isAvailable: z.string().nullable().transform((value) => value === "on"),
});

// -----------------------------------------------------------------------------
// Grupo de opções
// -----------------------------------------------------------------------------

export const optionGroupSchema = z
  .object({
    name: requiredText("Nome do grupo", 60),
    minSelect: z.coerce
      .number()
      .int("Use um número inteiro.")
      .min(0, "Mínimo não pode ser negativo.")
      .max(20, "Mínimo alto demais."),
    maxSelect: z.coerce
      .number()
      .int("Use um número inteiro.")
      .min(1, "Máximo precisa ser ao menos 1.")
      .max(20, "Máximo alto demais."),
  })
  .refine((value) => value.maxSelect >= value.minSelect, {
    message: "O máximo não pode ser menor que o mínimo.",
    path: ["maxSelect"],
  });

/** Acréscimo pode ser negativo — "sem queijo, -R$ 2,00". */
export const optionSchema = z.object({
  name: requiredText("Nome da opção", 60),
  priceDelta: z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed === "") return 0;

    const cents = parseToCents(trimmed);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Acréscimo inválido." });
      return z.NEVER;
    }
    return cents;
  }),
});

// -----------------------------------------------------------------------------
// Loja
// -----------------------------------------------------------------------------

/** Guarda só os dígitos e completa o 55 do Brasil quando o lojista não digita. */
export function normalizeWhatsapp(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // 10 = fixo com DDD, 11 = celular com DDD
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith("55") ? digits : null;
  }
  return null;
}

export const storeSchema = z.object({
  name: requiredText("Nome da loja"),
  description: optionalText(500),
  whatsapp: z.string().transform((value, ctx) => {
    const normalized = normalizeWhatsapp(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Informe DDD + número. Ex.: (11) 98765-4321",
      });
      return z.NEVER;
    }
    return normalized;
  }),
  address: optionalText(200),
  cep: cepField,
  stateUf: ufField,
  ibgeCode: ibgeField,
  city: requiredText("Cidade", 80),
  neighborhood: requiredText("Bairro", 80),
  cuisineTags: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
    ),
  kind: z.enum(["food", "drinks", "both"]),
  deliveryFee: money("Taxa de entrega"),
  minOrder: money("Pedido mínimo"),
});

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------


export const newStoreSchema = z.object({
  name: requiredText("Nome da loja"),
  slug: z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed === "") return null;

    // Alguém já colou a URL do site da loja aqui. O rótulo do campo foi
    // corrigido, mas a validação também precisa recusar — o slug entra na
    // URL pública e não tem como desfazer depois de indexado.
    // Pega qualquer coisa com esquema, "www." ou domínio: o erro é colar um
    // endereço, e endereço vem em muitas formas.
    if (
      trimmed.includes("://") ||
      /^www\./i.test(trimmed) ||
      /\.(com|net|org|br|io|app|shop)\b/i.test(trimmed)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Aqui vai só o apelido da loja dentro do Petire, não o endereço do site dela.",
      });
      return z.NEVER;
    }

    const slug = slugify(trimmed);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      ctx.addIssue({ code: "custom", message: "Use letras, números e hífen." });
      return z.NEVER;
    }
    return slug;
  }),
  cep: cepField,
  stateUf: ufField,
  ibgeCode: ibgeField,
  address: optionalText(200),
  city: requiredText("Cidade", 80),
  neighborhood: requiredText("Bairro", 80),
  whatsapp: z.string().transform((value, ctx) => {
    const normalized = normalizeWhatsapp(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Informe DDD + número. Ex.: (11) 98765-4321",
      });
      return z.NEVER;
    }
    return normalized;
  }),
  kind: z.enum(["food", "drinks", "both"]),
  managerEmail: z.email("E-mail inválido."),
  trialDays: z.coerce
    .number()
    .int()
    .min(0, "Não pode ser negativo.")
    .max(365, "Máximo de 365 dias."),
});

/** Edição pelo admin: os mesmos campos da criação, menos o login do lojista. */
export const editStoreSchema = newStoreSchema
  .omit({ managerEmail: true, trialDays: true })
  .extend({
    // Na edição o apelido é obrigatório — deixar em branco apagaria a URL.
    slug: newStoreSchema.shape.slug.refine(
      (value) => value !== null,
      "Informe o apelido da loja.",
    ),
    description: optionalText(500),
    cuisineTags: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10),
      ),
    deliveryFee: money("Taxa de entrega"),
    minOrder: money("Pedido mínimo"),
  });

export const subscriptionSchema = z.object({
  storeId: uuid,
  status: z.enum(["trial", "active", "past_due", "suspended"]),
  until: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Data inválida.",
    ),
});

// -----------------------------------------------------------------------------
// Horário
// -----------------------------------------------------------------------------

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const storeHourSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    opensAt: time,
    closesAt: time,
  })
  .refine((value) => value.opensAt !== value.closesAt, {
    message: "Abertura e fechamento não podem ser iguais.",
    path: ["closesAt"],
  });

export { slugify, uuid };
