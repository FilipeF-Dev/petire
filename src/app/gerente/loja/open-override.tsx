import { Card } from "@/components/ui";

import { setOpenOverride } from "./actions";

const MODES = [
  {
    mode: "auto",
    label: "Seguir horário",
    hint: "A loja abre e fecha sozinha pelo horário cadastrado.",
  },
  {
    mode: "open",
    label: "Forçar aberta",
    hint: "Fica aberta mesmo fora do horário.",
  },
  {
    mode: "closed",
    label: "Forçar fechada",
    hint: "Fechei mais cedo hoje, parou a entrega, faltou gás.",
  },
] as const;

export function OpenOverride({
  isOpenManual,
  isOpenNow,
}: {
  isOpenManual: boolean | null;
  isOpenNow: boolean;
}) {
  const current =
    isOpenManual === null ? "auto" : isOpenManual ? "open" : "closed";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-medium">Status agora</p>
        <span
          className={
            isOpenNow
              ? "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
              : "rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
          }
        >
          {isOpenNow ? "Aberta" : "Fechada"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {MODES.map(({ mode, label, hint }) => (
          <form action={setOpenOverride} key={mode}>
            <input type="hidden" name="mode" value={mode} />
            <button
              type="submit"
              className={
                current === mode
                  ? "w-full rounded-lg border border-neutral-900 px-3 py-2.5 text-left transition dark:border-neutral-200"
                  : "w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              }
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {hint}
              </span>
            </button>
          </form>
        ))}
      </div>

      {current !== "auto" ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          O horário cadastrado está sendo ignorado. Volte para
          &ldquo;Seguir horário&rdquo; quando normalizar.
        </p>
      ) : null}
    </Card>
  );
}
