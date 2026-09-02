"use client";

import { useEffect } from "react";

/**
 * Registra o service worker, que é o que torna o Petire instalável.
 *
 * Só em produção: em desenvolvimento ele intercepta os assets do Turbopack e
 * o hot reload passa a servir versão velha, com sintoma difícil de ligar à
 * causa.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem service worker o site funciona igual, só não instala.
      });
    };

    // Depois do load, para não disputar banda com o primeiro render.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
