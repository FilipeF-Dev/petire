"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { useCustomerLocation } from "@/components/location-bar";
import { useCart } from "@/components/use-cart";
import { clearStore, removeLine, setQuantity } from "@/lib/cart";

import type { PlaceContact } from "@/lib/customer-location";
import { siteUrl } from "@/lib/env";
import { formatCents, formatDeliveryFee } from "@/lib/money";
import {
  buildOrderMessage,
  whatsappUrl,
  type Delivery,
} from "@/lib/order-message";
import { rememberOrder } from "@/lib/recent-orders";

import { CheckoutDialog } from "./checkout-dialog";

import { resolveCart, type ResolvedCart, type ResolvedStore } from "./actions";

function reportWhatsappClick(storeId: string) {
  const body = JSON.stringify({ storeId, kind: "whatsapp_click" });

  // sendBeacon porque logo em seguida a aba sai para o WhatsApp; um fetch
  // normal seria cancelado no meio.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/events",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

type Address = Omit<Delivery, "recipient" | "number" | "complement">;

function StoreOrder({
  store,
  address,
}: {
  store: ResolvedStore;
  address: Address | null;
}) {
  const [sent, setSent] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const missing = store.minOrderCents - store.subtotalCents;

  // `send` roda no clique de "Enviar no WhatsApp" dentro do diálogo, que é um
  // gesto direto do cliente — é o que o iOS exige para não barrar a saída.
  function send(contact: PlaceContact) {
    reportWhatsappClick(store.storeId);

    // "Peça novamente", na home. Registrado no envio e não na visita: a lista
    // responde de onde o cliente já pediu, e cardápio aberto por curiosidade
    // não é pedido. Vai junto a identidade dos itens, para o mesmo pedido
    // voltar num toque — preço e disponibilidade são relidos na hora, como no
    // carrinho.
    rememberOrder({
      storeId: store.storeId,
      slug: store.slug,
      name: store.name,
      lines: store.lines.map((line) => ({
        productId: line.productId,
        optionIds: line.optionIds,
        quantity: line.quantity,
        note: line.note,
      })),
    });

    setIsAsking(false);
    setSent(true);

    // A mensagem é montada aqui, e não no servidor, porque leva o endereço do
    // cliente. Ele sai do browser dele direto para o WhatsApp da loja.
    const message = buildOrderMessage({
      storeName: store.name,
      // O caminho de volta. Sem cadastro, esta mensagem na conversa do cliente
      // é o que ele encontra quando quer pedir de novo.
      storeUrl: `${siteUrl}/loja/${store.slug}`,
      lines: store.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        totalCents: line.totalCents,
        options: line.options,
        note: line.note,
      })),
      subtotalCents: store.subtotalCents,
      deliveryFeeCents: store.deliveryFeeCents,
      totalCents: store.totalCents,
      delivery: {
        cep: address?.cep ?? "",
        street: address?.street ?? "",
        neighborhood: address?.neighborhood ?? "",
        city: address?.city ?? "",
        uf: address?.uf ?? "",
        ...contact,
      },
    });

    // location.href e não window.open: o Safari no iOS bloqueia popup aberto
    // fora de um gesto direto, e o pedido simplesmente não sairia.
    window.location.href = whatsappUrl(store.whatsappE164, message);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Link href={`/loja/${store.slug}`} className="font-medium">
            {store.name}
          </Link>
          {store.isOpenNow ? null : (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              fechada
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => clearStore(store.storeId)}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
        >
          esvaziar
        </button>
      </div>

      <ul>
        {store.lines.map((line) => (
          <li
            key={line.id}
            className="flex items-start gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{line.name}</p>

              {line.options.length > 0 ? (
                <ul className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {line.options.map((option) => (
                    <li key={`${option.groupName}-${option.name}`}>
                      {option.groupName}: {option.name}
                    </li>
                  ))}
                </ul>
              ) : null}

              {line.note ? (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Obs: {line.note}
                </p>
              ) : null}

              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.id, line.quantity - 1)}
                    aria-label={`Diminuir ${line.name}`}
                    className="px-2.5 py-1 leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.id, line.quantity + 1)}
                    aria-label={`Aumentar ${line.name}`}
                    className="px-2.5 py-1 leading-none"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-xs text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
                >
                  remover
                </button>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-medium tabular-nums">
                {formatCents(line.totalCents)}
              </p>
              {line.originalUnitCents !== null ? (
                <p className="text-xs text-neutral-400 line-through tabular-nums">
                  {formatCents(line.originalUnitCents * line.quantity)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500 dark:text-neutral-400">Subtotal</span>
          <span className="tabular-nums">{formatCents(store.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500 dark:text-neutral-400">Entrega</span>
          <span className="tabular-nums">
            {formatDeliveryFee(store.deliveryFeeCents)}
          </span>
        </div>
        <div className="mt-1 flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(store.totalCents)}</span>
        </div>
      </div>

      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        {/*
          Loja fechada não é beco sem saída, mas também não pode ser o mesmo
          botão verde de sempre. Quem manda o pedido de madrugada não é
          respondido, e a culpa fica dividida entre a loja e o Petire — então o
          envio continua possível, e deixa de ser a ação em destaque.
        */}
        {store.isOpenNow ? null : (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium">
              {store.name} está fechada
              {store.opensLabel ? ` — ${store.opensLabel}` : null}.
            </p>
            <p className="mt-0.5">
              Ela só vê a mensagem quando abrir. Seu carrinho fica guardado até
              lá.
            </p>
          </div>
        )}

        {store.meetsMinimum ? (
          <button
            type="button"
            onClick={() => setIsAsking(true)}
            className={
              store.isOpenNow
                ? "w-full rounded-lg bg-green-600 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-green-700"
                : "w-full rounded-lg border border-neutral-300 px-4 py-3.5 text-sm font-medium transition hover:bg-surface-hover dark:border-neutral-700"
            }
          >
            {sent
              ? "Abrindo o WhatsApp…"
              : store.isOpenNow
                ? `Fazer pedido — ${store.name}`
                : "Enviar mesmo assim"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-neutral-200 px-4 py-3.5 text-sm font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
            >
              Faltam {formatCents(missing)} para o pedido mínimo
            </button>
            <p className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Esta loja atende a partir de {formatCents(store.minOrderCents)}.
            </p>
          </>
        )}

        <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
          O pedido abre no WhatsApp da loja já escrito. Entrega e pagamento você
          combina direto com ela.
        </p>
      </div>

      {isAsking ? (
        <CheckoutDialog
          storeName={store.name}
          address={address}
          onCancel={() => setIsAsking(false)}
          onConfirm={send}
        />
      ) : null}
    </section>
  );
}

export function CartView() {
  const lines = useCart();
  const location = useCustomerLocation();

  const address: Address | null = location
    ? {
        cep: location.cep,
        street: location.street,
        neighborhood: location.neighborhood,
        city: location.city,
        uf: location.uf,
      }
    : null;
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (lines.length === 0) return;

    startTransition(async () => {
      const resolved = await resolveCart(lines);

      // Item que saiu do cardápio ou esgotou some do carrinho — deixá-lo ali
      // só produziria um pedido que a loja não consegue atender.
      for (const id of resolved.dropped) removeLine(id);

      setCart(resolved);
    });
  }, [lines]);

  // Carrinho vazio é derivado das linhas, não de estado: o servidor ainda nem
  // precisa ser consultado para saber que não há nada.
  const isEmpty = lines.length === 0 || cart?.stores.length === 0;

  if (!isEmpty && cart === null) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Carregando o carrinho…
      </p>
    );
  }

  if (isEmpty || cart === null) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
        <p className="font-medium">Seu carrinho está vazio</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          Escolha uma loja do seu bairro e monte o pedido. Você pode juntar
          itens de lojas diferentes.
        </p>
        <Link
          href="/lojas"
          className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Ver lojas
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${isPending ? "opacity-60" : ""}`}>
      {cart.dropped.length > 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {cart.dropped.length === 1
            ? "Um item saiu do cardápio e foi removido do carrinho."
            : `${cart.dropped.length} itens saíram do cardápio e foram removidos do carrinho.`}
        </p>
      ) : null}

      {cart.stores.length > 1 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Seu carrinho tem itens de {cart.stores.length} lojas. Cada uma recebe
          o pedido no próprio WhatsApp, então são {cart.stores.length} envios.
        </p>
      ) : null}

      {address ? null : (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-2.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          Informe seu CEP no topo da página e a rua já vai escrita na mensagem.
        </p>
      )}

      {cart.stores.map((store) => (
        <StoreOrder key={store.storeId} store={store} address={address} />
      ))}
    </div>
  );
}
