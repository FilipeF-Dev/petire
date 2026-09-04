"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/recent-orders";

/**
 * O convite para instalar o Petire.
 *
 * O produto é uma web page instalável, e instalada ela vira ícone na tela do
 * cliente — que é o caminho de volta mais curto que existe, mais curto até que
 * o link no WhatsApp.
 *
 * O momento importa mais que o texto. Convidar quem acabou de chegar é pedir
 * compromisso antes de entregar valor, e o convite é recusado. Aqui ele só
 * aparece para quem **já pediu pelo menos uma vez** — o valor já foi
 * percebido, e o convite responde a uma pergunta que a pessoa acabou de ter.
 *
 * Não é na hora do envio de propósito: ali a aba sai para o WhatsApp e nada do
 * que estiver na tela é lido. Aqui é na volta.
 *
 * Só Chromium dispara `beforeinstallprompt`. No iOS o Safari não tem evento
 * equivalente e a instalação é pelo menu Compartilhar — então lá o convite
 * simplesmente não aparece, em vez de virar um tutorial que ninguém segue.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KEY = "petire.instalar.v1";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "nao";
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const stores = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    // Já instalado: o app abre em standalone e não há o que convidar. E quem
    // já disse "agora não" não é perguntado de novo.
    //
    // As duas checagens ficam aqui e não em estado: sem assinar o evento, o
    // convite nunca chega, e não há nada para esconder depois.
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (wasDismissed()) return;

    const onPrompt = (nativeEvent: Event) => {
      // Sem isto o Chrome mostra o próprio banner, no momento dele, para quem
      // acabou de chegar — que é justamente o convite que não funciona.
      nativeEvent.preventDefault();
      setEvent(nativeEvent as InstallEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event || stores.length === 0) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "nao");
    } catch {
      // Storage bloqueado: some nesta sessão e volta na próxima. Melhor do que
      // insistir para sempre.
    }
    setEvent(null);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    // Aceito ou recusado, o evento não pode ser usado duas vezes.
    setEvent(null);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
      <p className="font-medium">Deixe o Petire na tela inicial</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Vira um ícone no celular, abre direto no seu bairro. Não ocupa espaço
        como um aplicativo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Agora não
        </button>
      </div>
    </section>
  );
}
