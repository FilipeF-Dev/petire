import Link from "next/link";

import { signOut } from "@/app/entrar/actions";
import { PageTransition } from "@/components/page-transition";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 bg-surface dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/admin" className="font-semibold tracking-tight">
            Petire
            <span className="ml-2 text-xs font-normal text-neutral-500">
              admin
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-500 sm:inline dark:text-neutral-400">
              {session.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
