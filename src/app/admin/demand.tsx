import { Card } from "@/components/ui";
import { humanizePlace } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O mapa da demanda que o catálogo não atendeu.
 *
 * O plano é abrir um bairro por vez, e até aqui a escolha de qual bairro era
 * palpite. Estes são os dois sinais que o site já sabe produzir: o que as
 * pessoas procuraram e não acharam, e de onde elas vieram sem encontrar loja
 * nenhuma. O primeiro vira o script de vendas ("já tem gente procurando pizza
 * no seu bairro"); o segundo, a fila de cidades.
 *
 * Lido com service_role porque `demand_signals` tem RLS ligada e nenhuma
 * policy — ninguém enxerga a tabela pelo browser, nem o gerente. O admin já é
 * o único lugar que usa esta chave.
 *
 * A soma vem de `demand_summary()`, e não daqui, pelo mesmo motivo de
 * `store_metrics`: a janela de 30 dias é contada com o relógio do banco, que é
 * o que gravou as linhas.
 */

const WINDOW_DAYS = 30;
const TOP = 6;

type Row = { label: string; count: number };

function Column({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: Row[];
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        {hint}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Nada por enquanto.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 text-neutral-500 tabular-nums dark:text-neutral-400">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function DemandSignals() {
  const admin = createAdminClient();

  const [summary, suggestions] = await Promise.all([
    admin.rpc("demand_summary", { window_days: WINDOW_DAYS }),
    // A fila de prospecção: quem não encontrou nada disse qual loja queria.
    admin
      .from("store_suggestions")
      .select("id, store_name, contact, city_slug")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const rows = summary.data ?? [];
  const leads = suggestions.data ?? [];

  // Some inteira enquanto não há sinal nenhum. Um painel com quadros vazios no
  // topo ensina o admin a não olhar para essa parte da tela.
  if (rows.length === 0 && leads.length === 0) return null;

  const pick = (kind: string): Row[] =>
    rows
      .filter((row) => row.kind === kind)
      .slice(0, TOP)
      .map((row) => ({ label: row.label, count: Number(row.hits) }));

  const searches = pick("search_empty");
  // O slug é o que o banco guarda; "juiz-de-fora" numa lista para ler é ruído.
  const places = pick("area_uncovered").map((row) => ({
    ...row,
    label: humanizePlace(row.label),
  }));

  return (
    <Card className="mb-6 p-4">
      <p className="text-xs tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        Demanda não atendida · {WINDOW_DAYS} dias
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <Column
          title="Procuraram e não acharam"
          hint="quem convidar para o catálogo"
          rows={searches}
        />
        <Column
          title="Chegaram de cidade sem loja"
          hint="para onde expandir"
          rows={places}
        />
      </div>

      {/*
        A fila de prospecção. Diferente das duas colunas acima, aqui a abordagem
        já vem morna: "um cliente seu pediu que a gente falasse com você".
      */}
      {leads.length > 0 ? (
        <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm font-medium">Lojas indicadas por clientes</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            quem bater primeiro
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id} className="text-sm">
                <span className="font-medium">{lead.store_name}</span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {lead.contact ? ` · ${lead.contact}` : null}
                  {lead.city_slug ? ` · ${humanizePlace(lead.city_slug)}` : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
