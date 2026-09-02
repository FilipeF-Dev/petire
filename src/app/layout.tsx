import type { Metadata } from "next";
import { Geist } from "next/font/google";

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
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Petire",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
