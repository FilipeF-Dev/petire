import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { siteUrl, supportWhatsapp } from "@/lib/env";
import { formatCents } from "@/lib/money";
import {
  BASIC_PRICE_CENTS,
  FOUNDER_PRICE_CENTS,
  FOUNDER_SLOTS,
  FOUNDER_TRIAL_DAYS,
  monthlySavings,
} from "@/lib/pricing";
import { qrSvgPath } from "@/lib/qr";

import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Material de visita",
  robots: { index: false, follow: false },
};

/**
 * A folha que fica na loja.
 *
 * A visita dura o tempo de o dono não estar com as mãos na chapa, e termina
 * antes de ele decidir. O que decide é o papel que fica no balcão e é lido
 * depois do movimento — por isso ele carrega a conta, o preço e o endereço, e
 * não depende de ninguém estar junto para explicar.
 *
 * Mora em `/admin` porque é ferramenta de quem vende, não do lojista: o
 * gerente já tem o kit dele em `/gerente/divulgar`, que fala com o cliente
 * final e não com quem ainda não é loja.
 *
 * Os números saem de `src/lib/pricing.ts`. Um folheto impresso com preço
 * diferente do site é o erro que só aparece na frente do lojista.
 */

/**
 * O faturamento do exemplo.
 *
 * Alto o bastante para a conta impressionar e baixo o bastante para a
 * lanchonete de bairro se reconhecer nele. Quem fatura mais faz a conta dele
 * na hora, em `/cadastrar`; quem fatura menos não se sente enganado.
 */
const EXAMPLE_REVENUE_CENTS = 500_000;
const EXAMPLE_COMMISSION_PERCENT = 23;

export default async function MaterialPage() {
  await requireAdmin();

  const signupUrl = `${siteUrl}/cadastrar`;
  const shortUrl = signupUrl.replace(/^https?:\/\//, "");
  const qr = qrSvgPath(signupUrl);

  const example = monthlySavings({
    revenueCents: EXAMPLE_REVENUE_CENTS,
    commissionPercent: EXAMPLE_COMMISSION_PERCENT,
    priceCents: BASIC_PRICE_CENTS,
  });

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Material de visita"
          description="A folha que fica na loja. Imprima uma para cada visita."
          action={<PrintButton />}
        />
      </div>

      {/*
        Fundo branco e tinta preta fixos, como o cartaz do balcão: o dono vai
        apontar a câmera para este papel, e QR claro sobre fundo escuro não lê
        na maioria dos aparelhos.
      */}
      <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 text-neutral-900 dark:border-neutral-800 print:border-0 print:p-0">
        <p className="text-xs tracking-widest uppercase">Peça direto da loja</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">Petire</p>

        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
          Seu cardápio online, sem comissão por pedido.
        </h2>
        <p className="mt-2 text-sm">
          O cliente monta o pedido no celular e ele chega pronto no seu
          WhatsApp. Você não muda nada de como já trabalha.
        </p>

        {example ? (
          <div className="mt-6 rounded-lg border border-neutral-300 p-4">
            <p className="text-sm font-medium">A conta</p>
            <p className="mt-1 text-sm">
              Quem fatura {formatCents(EXAMPLE_REVENUE_CENTS)} por mês no
              aplicativo, a {EXAMPLE_COMMISSION_PERCENT}%, deixa lá{" "}
              {formatCents(example.commissionCents)} de comissão. No Petire são{" "}
              {formatCents(BASIC_PRICE_CENTS)} fixos —{" "}
              <strong>
                {formatCents(example.monthlyCents)} a mais no seu caixa, todo
                mês.
              </strong>
            </p>
            {/*
              O endereço termina a frase sem ponto final: impresso, o ponto
              colado no fim da URL é digitado junto por quem for teclar.
            */}
            <p className="mt-2 text-xs">
              Faça a sua conta com os seus números em{" "}
              <span className="font-medium">{shortUrl}</span>
            </p>
          </div>
        ) : null}

        <ul className="mt-6 flex flex-col gap-1.5 text-sm">
          <li>· Você edita cardápio, preço e promoção pelo celular, na hora.</li>
          <li>· Dá para colar o cardápio que você já tem, em texto, de uma vez.</li>
          <li>· O pagamento não passa por aqui. Quem cobra é você.</li>
          <li>· Não precisa sair do aplicativo que você já usa.</li>
        </ul>

        <div className="mt-6 rounded-lg bg-neutral-100 p-4">
          <p className="text-sm font-semibold">
            As {FOUNDER_SLOTS} primeiras lojas do bairro
          </p>
          <p className="mt-1 text-sm">
            {FOUNDER_TRIAL_DAYS} dias grátis, e depois{" "}
            {formatCents(FOUNDER_PRICE_CENTS)} por mês — travado, não sobe
            depois. Sem fidelidade e sem multa.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <svg
            // Zona de silêncio de 4 módulos: QR colado sem margem escaneia mal.
            viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}
            className="size-32 shrink-0"
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR code para ${signupUrl}`}
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

          <div className="min-w-0">
            <p className="text-sm font-medium">Cadastre sua loja</p>
            <p className="mt-0.5 text-sm break-all">{shortUrl}</p>
            {supportWhatsapp ? (
              <p className="mt-2 text-sm">
                Dúvida no WhatsApp: {formatWhatsapp(supportWhatsapp)}
              </p>
            ) : (
              /*
                Sem número configurado o papel não finge ter contato: sobra a
                linha para quem visitou escrever o dele, que é melhor do que um
                canal de suporte que não existe.
              */
              <p className="mt-3 text-sm">
                Falou com:{" "}
                <span className="inline-block w-40 border-b border-neutral-400" />
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 5532988887777 → (32) 98888-7777. Só para o papel; o link usa os dígitos. */
function formatWhatsapp(digits: string): string {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const match = local.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}
