/** Índice = `store_hours.weekday`, com 0 = domingo (mesmo do `extract(dow)`). */
export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/** Nomes que o schema.org espera em `openingHoursSpecification`. */
export const SCHEMA_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "18:00:00" → "18:00" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}
