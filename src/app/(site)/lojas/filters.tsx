"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const KINDS = [
  { value: "food", label: "Comida" },
  { value: "drinks", label: "Bebida" },
] as const;

function chipClass(active: boolean) {
  return active
    ? "shrink-0 rounded-full border border-neutral-900 bg-neutral-900 px-3.5 py-1.5 text-sm text-white dark:border-white dark:bg-white dark:text-neutral-900"
    : "shrink-0 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900";
}

/**
 * Os filtros moram na URL, não em estado local: assim o cliente pode mandar
 * "olha as pizzarias abertas aqui" no grupo da família e o link abre igual.
 */
export function StoreFilters({ tags }: { tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);

    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function toggle(key: string, value: string) {
    update(key, params.get(key) === value ? null : value);
  }

  return (
    <div
      className={`flex flex-col gap-3 ${isPending ? "opacity-60" : ""} transition-opacity`}
    >
      <input
        type="search"
        defaultValue={params.get("q") ?? ""}
        placeholder="Buscar loja pelo nome"
        aria-label="Buscar loja pelo nome"
        onChange={(event) => update("q", event.target.value || null)}
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => toggle("aberto", "1")}
          aria-pressed={params.get("aberto") === "1"}
          className={chipClass(params.get("aberto") === "1")}
        >
          Aberta agora
        </button>

        {KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            onClick={() => toggle("tipo", kind.value)}
            aria-pressed={params.get("tipo") === kind.value}
            className={chipClass(params.get("tipo") === kind.value)}
          >
            {kind.label}
          </button>
        ))}

        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle("tag", tag)}
            aria-pressed={params.get("tag") === tag}
            className={chipClass(params.get("tag") === tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
