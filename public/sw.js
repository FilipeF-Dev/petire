/**
 * Service worker do Petire.
 *
 * A decisão que vale a pena entender aqui: **HTML nunca é servido do cache.**
 *
 * Um app de delivery que mostra um cardápio velho é pior do que um app que não
 * abre. Se a página vier do cache, o cliente pode pedir um item que acabou
 * duas horas atrás e descobrir isso só quando a loja responder no WhatsApp.
 * Então navegação é sempre rede; sem rede, mostramos a página de offline —
 * o que é honesto, já que sem rede também não dá para mandar o pedido.
 *
 * O cache serve para o que não pode envelhecer: os assets do Next, que têm
 * hash no nome, e os ícones.
 */

const VERSION = "petire-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/.test(url.pathname)
  );
}

function isPrivate(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/gerente") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/entrar")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Painel e API nunca passam pelo cache: um deles carrega sessão, o outro
  // grava métrica.
  if (isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Cache-first: o Next põe hash no nome, então o conteúdo nunca muda sem
    // o caminho mudar junto.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
