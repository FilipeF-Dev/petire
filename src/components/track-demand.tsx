"use client";

import { useEffect } from "react";

/**
 * Registra a demanda que o catálogo não atendeu.
 *
 * Busca sem resultado e cidade sem loja são hoje becos sem saída silenciosos —
 * e são o dado que diz onde abrir o próximo bairro e qual loja convidar
 * primeiro. O plano é um bairro por vez; até aqui, qual bairro era palpite.
 *
 * Vai só o slug do lugar e o termo procurado. O CEP do cliente não sai do
 * aparelho dele (ver src/lib/customer-location.ts) e não é este recurso que vai
 * começar a guardá-lo.
 */

type Signal = {
  kind: "search_empty" | "area_uncovered" | "search_hit";
  citySlug: string | null;
  neighborhoodSlug: string | null;
  term: string | null;
};

/**
 * O campo de busca reescreve a URL a cada tecla, então "coxinha" passaria por
 * "c", "co", "cox"… — sete sinais falsos e um verdadeiro. A espera deixa
 * passar só o termo em que a pessoa parou.
 */
const SETTLE_MS = 1500;

/** Uma vez por sessão: voltar para a mesma busca não é uma nova frustração. */
function alreadySent(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, "1");
    return false;
  } catch {
    return false;
  }
}

export function TrackDemand({
  kind,
  citySlug,
  neighborhoodSlug,
  term,
}: Signal) {
  useEffect(() => {
    const key = `petire.demanda.${kind}.${citySlug ?? ""}.${term ?? ""}`;

    const timer = window.setTimeout(() => {
      if (alreadySent(key)) return;

      const body = JSON.stringify({ kind, citySlug, neighborhoodSlug, term });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/demand",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }

      void fetch("/api/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Sinal perdido não pode atrapalhar quem está procurando.
      });
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [kind, citySlug, neighborhoodSlug, term]);

  return null;
}
