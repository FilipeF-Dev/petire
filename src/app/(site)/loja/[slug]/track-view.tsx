"use client";

import { useEffect } from "react";

/**
 * Registra a visita ao cardápio.
 *
 * Não dá para contar isso no servidor: a página é estática, então um render
 * cacheado não chega a executar nada. E é a métrica que o lojista vê no painel
 * quando decide se renova a mensalidade, então precisa ser real.
 *
 * Uma visita por sessão, não por render. Sem isso, o lojista conferindo a
 * própria página e o cliente que volta ao cardápio para conferir um preço
 * inflam o número que o próprio lojista vai usar para decidir se renova — e um
 * número que ele desconfia uma vez deixa de valer para sempre.
 *
 * `sessionStorage` e não `localStorage` de propósito: a janela é a sessão de
 * navegação, então voltar amanhã conta de novo, que é o comportamento certo
 * para uma métrica de 30 dias.
 */
function alreadyCounted(storeId: string): boolean {
  const key = `petire.visto.${storeId}`;

  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, "1");
    return false;
  } catch {
    // Storage bloqueado: melhor contar a mais do que não contar nada.
    return false;
  }
}

export function TrackStoreView({ storeId }: { storeId: string }) {
  useEffect(() => {
    if (alreadyCounted(storeId)) return;

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
