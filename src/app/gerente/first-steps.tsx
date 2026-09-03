import Link from "next/link";

import { Card } from "@/components/ui";

/**
 * O que ainda falta para a loja ficar pronta.
 *
 * O lojista entra pela primeira vez num painel vazio e não sabe o que fazer
 * primeiro — e cada dúvida dele vira uma ligação, que a mensalidade de R$30
 * não paga. A lista responde isso sozinha, com os dados que o painel já tem.
 *
 * Ela some quando tudo está feito. Uma lista de tarefas concluídas ocupando o
 * topo do painel para sempre vira ruído, e o lojista para de ler o que está
 * ali.
 */
export type Step = {
  done: boolean;
  label: string;
  hint: string;
  /** Sem href quando a tarefa não é do lojista — ver "colocar no ar". */
  href?: string;
};

function Check({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={
        done
          ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs text-white dark:bg-green-500 dark:text-neutral-900"
          : "mt-0.5 size-5 shrink-0 rounded-full border-2 border-neutral-300 dark:border-neutral-600"
      }
    >
      {done ? "✓" : null}
    </span>
  );
}

export function FirstSteps({ steps }: { steps: Step[] }) {
  const pending = steps.filter((step) => !step.done);
  if (pending.length === 0) return null;

  const done = steps.length - pending.length;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Primeiros passos</h2>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {done} de {steps.length}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-3">
            <Check done={step.done} />

            <div className="min-w-0">
              <p className={step.done ? "text-sm line-through opacity-60" : "text-sm"}>
                {step.href && !step.done ? (
                  <Link href={step.href} className="underline underline-offset-4">
                    {step.label}
                  </Link>
                ) : (
                  step.label
                )}
              </p>
              {step.done ? null : (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {step.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
