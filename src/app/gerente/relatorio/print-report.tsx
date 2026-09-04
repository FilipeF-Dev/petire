"use client";

import { Button } from "@/components/ui";

/** `@media print` em globals.css já tira cabeçalho, menu e rodapé. */
export function PrintReport() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}
