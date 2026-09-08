import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import {
  approachFor,
  fitRank,
  LAUNCH_TARGET,
  SURVEY_TARGET,
  type Survey,
} from "@/lib/prospects";
import { createAdminClient } from "@/lib/supabase/admin";

import { setProspectStatus } from "./actions";
import { ProspectForm } from "./prospect-form";

export const metadata: Metadata = {
  title: "Levantamento de rua",
  robots: { index: false, follow: false },
};

/**
 * O levantamento de rua, e o estado de cada porta.
 *
 * O primeiro bairro é o único que o produto não sabe escolher sozinho: sem
 * cliente no catálogo não há `demand_signals` para ler, e a decisão é tomada a
 * pé. Esta tela é essa caminhada, e responde as duas perguntas que decidem a
 * semana — se o bairro tem candidatas suficientes, e por qual porta começar.
 *
 * A ordem da lista não é a de cadastro: é a de encaixe (`fitRank`). Quem paga
 * comissão hoje e já atende no WhatsApp vem primeiro, porque é a visita com a
 * conversa mais curta, e as primeiras visitas de um bairro são as que decidem
 * se o fundador continua.
 */

type ProspectRow = Survey & {
  id: number;
  name: string;
  city: string;
  neighborhood: string;
  neighborhood_slug: string;
  status: "a_visitar" | "visitada" | "cadastrada" | "recusou";
};

const STATUS_LABEL: Record<ProspectRow["status"], string> = {
  a_visitar: "a visitar",
  visitada: "visitada",
  cadastrada: "cadastrada",
  recusou: "recusou",
};

const STATUS_CLASS: Record<ProspectRow["status"], string> = {
  a_visitar:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  visitada: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cadastrada:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  recusou:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

/** O próximo passo do funil, que é o único botão que importa em cada linha. */
const NEXT_STEPS: Record<
  ProspectRow["status"],
  { status: ProspectRow["status"]; label: string }[]
> = {
  a_visitar: [
    { status: "visitada", label: "Visitei" },
    { status: "recusou", label: "Não quis" },
  ],
  visitada: [
    { status: "cadastrada", label: "Cadastrou" },
    { status: "recusou", label: "Não quis" },
  ],
  cadastrada: [{ status: "visitada", label: "Reabrir" }],
  recusou: [{ status: "a_visitar", label: "Reabrir" }],
};

function Mark({ on, children }: { on: boolean; children: string }) {
  return (
    <span
      className={
        on
          ? "rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900"
          : "rounded-full border border-neutral-200 px-2 py-0.5 text-xs text-neutral-400 dark:border-neutral-800"
      }
    >
      {children}
    </span>
  );
}

export default async function ProspeccaoPage({
  searchParams,
}: PageProps<"/admin/prospeccao">) {
  await requireAdmin();

  const { bairro } = await searchParams;
  const admin = createAdminClient();

  const { data } = await admin
    .from("prospects")
    .select(
      "id, name, city, neighborhood, neighborhood_slug, has_menu, has_whatsapp, on_app, status",
    )
    .order("created_at", { ascending: false });

  const all = (data ?? []) as ProspectRow[];

  // O bairro em foco é o da anotação mais recente, porque quem abre esta tela
  // quase sempre acabou de anotar alguma coisa nele.
  const focus =
    (typeof bairro === "string" ? bairro : null) ??
    all[0]?.neighborhood_slug ??
    null;

  const places = [...new Map(all.map((p) => [p.neighborhood_slug, p])).values()];
  const rows = all
    .filter((p) => p.neighborhood_slug === focus)
    .sort((a, b) => fitRank(a) - fitRank(b) || a.name.localeCompare(b.name));

  const current = rows[0] ?? all[0];
  const registered = rows.filter((p) => p.status === "cadastrada").length;
  const missing = Math.max(0, SURVEY_TARGET - rows.length);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Levantamento de rua"
        description="As candidatas de um bairro, na ordem de quem abre a conversa mais curta."
      />

      {places.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {places.map((place) => (
            <Link
              key={place.neighborhood_slug}
              href={{
                pathname: "/admin/prospeccao",
                query: { bairro: place.neighborhood_slug },
              }}
            >
              <Button
                variant={
                  place.neighborhood_slug === focus ? "primary" : "secondary"
                }
              >
                {place.neighborhood}
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-medium">
            {current?.neighborhood}
            {current?.city ? ` · ${current.city}` : null}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {rows.length}{" "}
            {rows.length === 1 ? "candidata anotada" : "candidatas anotadas"} ·{" "}
            {registered} de {LAUNCH_TARGET} no ar
          </p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {missing > 0
              ? `Faltam ${missing} para as ${SURVEY_TARGET} do critério. Quinze, e não dez, porque nem toda visita fecha.`
              : `O bairro passou das ${SURVEY_TARGET} candidatas. Dá para começar a bater porta.`}
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="mb-4 text-sm font-medium">Anotar uma loja</p>
        <ProspectForm
          city={current?.city ?? ""}
          neighborhood={current?.neighborhood ?? ""}
        />
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma loja anotada"
          description="Ande no bairro candidato e anote o que dá para ver da calçada. Duas horas resolvem."
        />
      ) : (
        <Card>
          <ul>
            {rows.map((prospect) => {
              const approach = approachFor(prospect);

              return (
                <li
                  key={prospect.id}
                  className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3 first:border-t-0 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{prospect.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[prospect.status]}`}
                    >
                      {STATUS_LABEL[prospect.status]}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {approach.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Mark on={prospect.has_menu}>cardápio</Mark>
                    <Mark on={prospect.has_whatsapp}>WhatsApp</Mark>
                    <Mark on={prospect.on_app}>aplicativo</Mark>
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {approach.line}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {NEXT_STEPS[prospect.status].map((step) => (
                      <form key={step.status} action={setProspectStatus}>
                        <input
                          type="hidden"
                          name="prospectId"
                          value={prospect.id}
                        />
                        <input type="hidden" name="status" value={step.status} />
                        <Button type="submit" variant="secondary">
                          {step.label}
                        </Button>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
