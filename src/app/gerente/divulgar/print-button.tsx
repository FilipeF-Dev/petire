"use client";

import { Button } from "@/components/ui";

/** A impressão sai só com o cartaz: ver `@media print` em globals.css. */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Imprimir o cartaz
    </Button>
  );
}
