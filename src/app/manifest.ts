import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Petire — peça direto da loja",
    short_name: "Petire",
    description:
      "Cardápios das lojas do seu bairro. Você monta o pedido e fecha no WhatsApp da loja, sem taxa de serviço.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#c2410c",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // O Android recorta o ícone em círculo; este tem a folga necessária.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Lojas do bairro",
        url: "/lojas",
      },
      {
        name: "Meu carrinho",
        url: "/carrinho",
      },
    ],
  };
}
