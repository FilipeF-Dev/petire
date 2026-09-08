"use client";

import { Button } from "@/components/ui";

/** A impressão sai só com a folha: ver `@media print` em globals.css. */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}
