import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { RegisterServiceWorker } from "@/components/register-sw";
import { siteUrl } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Petire — peça direto da loja, sem taxa",
    template: "%s · Petire",
  },
  description:
    "Cardápios das lanchonetes e distribuidoras do seu bairro. Você monta o pedido e fecha direto no WhatsApp da loja, sem taxa de serviço.",
  applicationName: "Petire",
  appleWebApp: {
    capable: true,
    title: "Petire",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Petire",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
  // O painel é usado com uma mão atrás do balcão; deixar o zoom livre é
  // acessibilidade, não enfeite.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
