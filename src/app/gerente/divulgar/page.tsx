import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { qrSvgPath } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

import { Artes } from "./artes";
import { CopyButton } from "./copy-button";
import { Printables } from "./printables";

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
 * copiar, publicar ou imprimir.
 *
 * As peças estão na ordem do alcance que cada uma tem, e não na ordem do
 * trabalho que dão: o status do WhatsApp fala com a lista inteira de contatos
 * hoje, o cartaz fala com quem já está na loja, e o adesivo vai para dentro da
 * casa de quem já comprou.
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

  const whatsappText = `Nosso cardápio está no Petire 🧡\n\nVocê monta o pedido pelo celular e ele chega aqui no nosso WhatsApp, já pronto. Sem app e sem cadastro.\n\n${url}`;
  const bioText = `Cardápio e pedidos: ${shortUrl}`;
  const instagramText = `Agora dá para pedir ${store.name} pelo celular 🧡\n\nVocê abre o cardápio, monta o pedido e ele cai direto no nosso WhatsApp — já escrito, com o endereço. Sem baixar app e sem fazer cadastro.\n\nO link está na bio: ${shortUrl}`;

  const qr = qrSvgPath(url);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Divulgar"
          description="Seu link, as artes prontas e o que imprimir para o balcão."
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
          <Artes storeName={store.name} url={url} shortUrl={shortUrl} />
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
          <p className="text-sm font-medium">Legenda do post</p>
          <p className="mt-2 rounded-lg bg-background p-3 text-sm whitespace-pre-line">
            {instagramText}
          </p>
          <div className="mt-3">
            <CopyButton text={instagramText} label="Copiar legenda" />
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

        <Printables
          storeName={store.name}
          shortUrl={shortUrl}
          url={url}
          qr={qr}
        />
      </div>
    </div>
  );
}
