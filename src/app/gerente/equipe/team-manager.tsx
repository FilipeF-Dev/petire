"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { inviteManager, removeManager, type InviteState } from "./actions";

export type TeamMember = {
  id: string;
  email: string;
};

function Invite({ full }: { full: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || full}>
      {pending ? "Criando…" : "Criar acesso"}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-neutral-500 underline-offset-4 hover:underline disabled:opacity-60 dark:text-neutral-400"
    >
      {pending ? "removendo…" : "remover"}
    </button>
  );
}

export function TeamManager({
  members,
  currentUserId,
  limit,
}: {
  members: TeamMember[];
  currentUserId: string;
  limit: number;
}) {
  const [invited, invite] = useActionState<InviteState, FormData>(
    inviteManager,
    { error: null },
  );
  const [removed, remove] = useActionState(removeManager, emptyFormState);

  const full = members.length >= limit;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-sm dark:border-neutral-800"
          >
            <span className="min-w-0 truncate">
              {member.email}
              {member.id === currentUserId ? (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}
                  · você
                </span>
              ) : null}
            </span>

            {member.id === currentUserId ? null : (
              <form action={remove}>
                <input type="hidden" name="managerId" value={member.id} />
                <RemoveButton />
              </form>
            )}
          </li>
        ))}
      </ul>

      <FormError message={removed.error} />

      {invited.created ? (
        <Card className="border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-900 dark:text-green-200">
            Acesso criado.
          </p>
          <p className="mt-1 text-sm text-green-800 dark:text-green-300">
            Passe estes dados para a pessoa. A senha não aparece de novo.
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-green-800 dark:text-green-400">E-mail</dt>
              <dd>
                <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                  {invited.created.email}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-green-800 dark:text-green-400">Senha</dt>
              <dd>
                <code className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                  {invited.created.password}
                </code>
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <form action={invite} className="flex flex-col gap-3">
        <Field
          label="Novo acesso"
          hint={
            full
              ? `Seu plano permite ${limit} ${limit === 1 ? "login" : "logins"}, e todos estão em uso.`
              : "A pessoa entra com o próprio e-mail e uma senha que aparece uma vez só."
          }
          error={invited.fieldErrors?.email}
        >
          <input
            name="email"
            type="email"
            defaultValue={invited.values?.email ?? ""}
            disabled={full}
            placeholder="socio@lanchonete.com"
            className={inputClass}
          />
        </Field>

        <div>
          <Invite full={full} />
        </div>

        <FormError message={invited.error} />
      </form>
    </div>
  );
}
