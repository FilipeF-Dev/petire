import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { qrSvgPath } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

import { CopyButton } from "./copy-button";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Divulgar",
  robots: { index: false, follow: false },
};

/**
 * O kit de divulgação da loja.
 *
 * As dez primeiras lojas entram num catálogo que ainda não tem movimento: elas
 * trazem os próprios clientes ou não recebem pedido nenhum, e uma loja que não
 * recebe pedido não renova. Aqui está o que ela precisa para isso, pronto para
 * copiar — o link, o texto e um cartaz com o QR para o balcão.
 */
export default async function DivulgarPage() {
  const session = await requireManager();
  if (!session.storeId) notFound();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("name, slug, neighborhood")
    .eq("id", session.storeId)
    .maybeSingle();

  if (!store) notFound();

  const url = `${siteUrl}/loja/${store.slug}`;
  // Sem o "https://" o link fica mais curto de ler e o WhatsApp continua
  // transformando em link sozinho.
  const shortUrl = url.replace(/^https?:\/\//, "");

  const whatsappText = `Nosso cardápio está no Petire 🧡\n\nVocê monta o pedido e ele chega aqui pelo WhatsApp, já pronto. Sem app, sem cadastro.\n\n${url}`;
  const bioText = `Cardápio e pedidos: ${shortUrl}`;

  const qr = qrSvgPath(url);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Divulgar"
          description="Seu link, o texto pronto e um cartaz para o balcão."
        />
      </div>

      <div className="flex max-w-2xl flex-col gap-6">
        <Card className="p-4 print:hidden">
          <p className="text-sm font-medium">Link da sua loja</p>
          <p className="mt-1 font-mono text-sm break-all text-neutral-600 dark:text-neutral-400">
            {url}
          </p>
          <div className="mt-3">
            <CopyButton text={url} label="Copiar link" />
          </div>
        </Card>

        <Card className="p-4 print:hidden">
          <p className="text-sm font-medium">Mensagem para o WhatsApp</p>
          <p className="mt-2 rounded-lg bg-background p-3 text-sm whitespace-pre-line">
            {whatsappText}
          </p>
          <div className="mt-3">
            <CopyButton text={whatsappText} label="Copiar mensagem" />
          </div>
        </Card>

        <Card className="p-4 print:hidden">
          <p className="text-sm font-medium">Bio do Instagram</p>
          <p className="mt-2 rounded-lg bg-background p-3 font-mono text-sm break-all">
            {bioText}
          </p>
          <div className="mt-3">
            <CopyButton text={bioText} label="Copiar" />
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm font-medium">Cartaz para o balcão</p>
            <PrintButton />
          </div>

          {/*
            O cartaz é a única coisa que vai para o papel. Fundo branco e tinta
            preta fixos: o cliente aponta a câmera para o papel, e um QR claro
            sobre fundo escuro não lê na maioria dos aparelhos.
          */}
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-900 dark:border-neutral-800 print:border-0">
            <p className="text-sm tracking-wide uppercase">Peça pelo celular</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {store.name}
            </p>

            <svg
              // Zona de silêncio de 4 módulos, como manda a especificação:
              // QR colado sem margem no papel escaneia mal.
              viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}
              className="mx-auto my-6 size-56 print:size-72"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR code para ${url}`}
            >
              <rect
                x={-4}
                y={-4}
                width={qr.size + 8}
                height={qr.size + 8}
                fill="#ffffff"
              />
              <path d={qr.path} fill="#000000" />
            </svg>

            <p className="text-base font-medium">{shortUrl}</p>
            <p className="mt-2 text-sm text-neutral-600">
              Cardápio completo e pedido direto no nosso WhatsApp.
              <br />
              Sem app e sem cadastro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
