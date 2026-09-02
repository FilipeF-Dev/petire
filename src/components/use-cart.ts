"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type CartLine,
} from "@/lib/cart";

/**
 * Assina o carrinho do localStorage.
 *
 * Não precisa de Context: o store é um módulo só, e o `useSyncExternalStore`
 * já resolve a hidratação — no servidor o carrinho é sempre vazio, e o React
 * troca pelo conteúdo real depois de hidratar, sem acusar mismatch.
 */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
