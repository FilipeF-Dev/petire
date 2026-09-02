import { moveItem } from "./actions";

/** Setas de ordenação. Server Component: são dois forms com submit direto. */
export function ReorderButtons({
  table,
  itemId,
  scopeId,
  isFirst,
  isLast,
  label,
}: {
  table: "products" | "menu_categories";
  itemId: string;
  scopeId?: string | null;
  isFirst: boolean;
  isLast: boolean;
  label: string;
}) {
  if (isFirst && isLast) return null;

  const buttonClass =
    "rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-neutral-800";

  return (
    <div className="flex shrink-0">
      {(["up", "down"] as const).map((direction) => (
        <form action={moveItem} key={direction}>
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="scopeId" value={scopeId ?? ""} />
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            disabled={direction === "up" ? isFirst : isLast}
            aria-label={`Mover ${label} para ${direction === "up" ? "cima" : "baixo"}`}
            className={buttonClass}
          >
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </div>
  );
}
