"use client";

import { useEffect } from "react";

/**
 * Registra a visita ao cardápio.
 *
 * Não dá para contar isso no servidor: a página é estática, então um render
 * cacheado não chega a executar nada. E é a métrica que o lojista vê no painel
 * quando decide se renova a mensalidade, então precisa ser real.
 */
export function TrackStoreView({ storeId }: { storeId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ storeId, kind: "store_view" });

    // sendBeacon não segura a navegação; o fetch é só o plano B.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Métrica perdida não pode quebrar a página do cliente.
    });
  }, [storeId]);

  return null;
}
