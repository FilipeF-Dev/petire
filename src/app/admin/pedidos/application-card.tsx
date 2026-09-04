"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, FormError } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import {
  approveApplication,
  rejectApplication,
  type NewStoreState,
} from "../actions";

/**
 * Um pedido na fila, com as duas saídas.
 *
 * A aprovação devolve a senha inicial **uma vez** — ela não fica gravada em
 * lugar nenhum legível. Por isso o card troca de estado em vez de recarregar a
 * lista: recarregar levaria a senha embora antes de alguém copiar.
 */

export type Application = {
  id: number;
  store_name: string;
  manager_email: string;
  whatsapp_e164: string;
  cep: string | null;
  address: string | null;
  city: string;
  neighborhood: string;
  state_uf: string | null;
  kind: string;
  note: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  food: "Comida",
  drinks: "Bebida",
  both: "Comida e bebida",
};

function Approve() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando…" : "Aprovar e criar loja"}
    </Button>
  );
}

function Reject() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "…" : "Recusar"}
    </Button>
  );
}

export function ApplicationCard({ application }: { application: Application }) {
  const [approved, approve] = useActionState<NewStoreState, FormData>(
    approveApplication,
    { error: null },
  );
  const [rejected, reject] = useActionState(rejectApplication, emptyFormState);

  if (rejected.savedAt && !rejected.error) {
    return (
      <Card className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
        {application.store_name} — recusada.
      </Card>
    );
  }

  if (approved.created) {
    return (
      <Card className="border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <p className="font-medium text-green-900 dark:text-green-200">
          {application.store_name} está criada, fora do ar.
        </p>
        <p className="mt-1 text-sm text-green-800 dark:text-green-300">
          Mande estas credenciais no WhatsApp {application.whatsapp_e164}. A
          senha não aparece de novo.
        </p>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-green-800 dark:text-green-400">E-mail</dt>
            <dd>
              <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                {approved.created.email}
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-green-800 dark:text-green-400">Senha</dt>
            <dd>
              <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                {approved.created.password}
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-green-800 dark:text-green-400">Link</dt>
            <dd>
              <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                /loja/{approved.created.slug}
              </code>
            </dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">{application.store_name}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {application.neighborhood}, {application.city}
            {application.state_uf ? `/${application.state_uf}` : null}
            {application.address ? ` · ${application.address}` : null}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {KIND_LABEL[application.kind] ?? application.kind} · WhatsApp{" "}
            {application.whatsapp_e164} · {application.manager_email}
          </p>
        </div>
        <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
          {new Date(application.created_at).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {application.note ? (
        <p className="mt-3 rounded-lg bg-background p-3 text-sm whitespace-pre-line text-neutral-600 dark:text-neutral-400">
          {application.note}
        </p>
      ) : null}

      {/*
        O número é o defeito mais caro do Petire: se estiver errado, o cliente
        pede, ninguém responde, e a culpa fica com a loja e com o site ao mesmo
        tempo. Um toque para conferir antes de aprovar.
      */}
      <a
        href={`https://wa.me/${application.whatsapp_e164}?text=${encodeURIComponent(
          `Olá! Aqui é do Petire. Recebemos o cadastro da ${application.store_name} — este número é o que recebe os pedidos?`,
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm underline underline-offset-4"
      >
        Conferir o número no WhatsApp
      </a>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="applicationId" value={application.id} />
          <Approve />
        </form>
        <form action={reject}>
          <input type="hidden" name="applicationId" value={application.id} />
          <Reject />
        </form>
      </div>

      <FormError message={approved.error ?? rejected.error} />
    </Card>
  );
}
