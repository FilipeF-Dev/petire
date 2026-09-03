"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import {
  resetManagerPassword,
  updateManagerEmail,
  type NewStoreState,
} from "../../actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

/**
 * Acesso do lojista ao painel dele.
 *
 * A loja costuma nascer com um e-mail provisório, porque o cadastro acontece
 * antes de o dono passar o endereço dele. E não existe "esqueci minha senha"
 * no MVP: quando o lojista perde a senha, ele liga e você gera outra aqui.
 */
export function ManagerAccess({
  managerId,
  email,
}: {
  managerId: string;
  email: string;
}) {
  const [emailState, emailAction] = useActionState(
    updateManagerEmail,
    emptyFormState,
  );
  const [passwordState, passwordAction] = useActionState<
    NewStoreState,
    FormData
  >(resetManagerPassword, { error: null });

  return (
    <section className="max-w-lg rounded-xl border border-neutral-200 bg-surface p-5 dark:border-neutral-800">
      <h2 className="font-medium">Acesso do lojista</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Com o que ele entra em <code>/entrar</code> para montar o cardápio.
      </p>

      <form action={emailAction} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="managerId" value={managerId} />

        <Field
          label="E-mail de acesso"
          hint="Trocar aqui muda o login dele na hora. A senha não muda."
          error={emailState.fieldErrors?.email}
        >
          <input
            name="email"
            type="email"
            defaultValue={emailState.values?.email ?? email}
            required
            className={inputClass}
          />
        </Field>

        <FormError message={emailState.error} />

        <div className="flex items-center gap-3">
          <Submit label="Salvar e-mail" />
          {emailState.savedAt && !emailState.error ? (
            <span className="text-sm text-green-700 dark:text-green-400">
              E-mail trocado.
            </span>
          ) : null}
        </div>
      </form>

      <form
        action={passwordAction}
        className="mt-5 flex flex-col gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800"
      >
        <input type="hidden" name="managerId" value={managerId} />

        <div>
          <p className="text-sm font-medium">Senha</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Não dá para consultar a senha atual — o banco guarda só o hash.
            Gerar uma nova invalida a anterior na hora.
          </p>
        </div>

        {passwordState.created ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-950">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Senha nova — anote agora, ela não aparece de novo:
            </p>
            <code className="mt-1 block text-base text-amber-900 dark:text-amber-100">
              {passwordState.created.password}
            </code>
          </div>
        ) : null}

        <FormError message={passwordState.error} />

        <div>
          <Submit label="Gerar nova senha" />
        </div>
      </form>
    </section>
  );
}
