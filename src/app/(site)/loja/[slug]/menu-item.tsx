"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { addToCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";

export type MenuOption = {
  id: string;
  name: string;
  price_delta_cents: number;
  is_available: boolean;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  options: MenuOption[];
};

export type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  priceCents: number;
  originalPriceCents: number | null;
  promotionLabel: string | null;
  option_groups: MenuOptionGroup[];
};

function reportCartAdd(storeId: string, productId: string) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, productId, kind: "cart_add" }),
    keepalive: true,
  }).catch(() => {
    // Métrica perdida não pode atrapalhar quem está pedindo.
  });
}

export function MenuItem({
  product,
  storeId,
  storeIsOpen,
}: {
  product: MenuProduct;
  storeId: string;
  storeIsOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const groups = useMemo(
    () =>
      product.option_groups
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => option.is_available),
        }))
        .filter((group) => group.options.length > 0),
    [product.option_groups],
  );

  function reset() {
    setSelected({});
    setNote("");
    setQuantity(1);
  }

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Sem isto, a página atrás do painel rola junto no celular.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  function toggleOption(group: MenuOptionGroup, optionId: string) {
    setSelected((current) => {
      const chosen = current[group.id] ?? [];

      if (chosen.includes(optionId)) {
        return { ...current, [group.id]: chosen.filter((id) => id !== optionId) };
      }
      // Grupo de escolha única troca em vez de acumular.
      if (group.max_select === 1) {
        return { ...current, [group.id]: [optionId] };
      }
      if (chosen.length >= group.max_select) return current;

      return { ...current, [group.id]: [...chosen, optionId] };
    });
  }

  const chosenIds = Object.values(selected).flat();

  const extrasCents = groups
    .flatMap((group) => group.options)
    .filter((option) => chosenIds.includes(option.id))
    .reduce((total, option) => total + option.price_delta_cents, 0);

  const unitCents = Math.max(0, product.priceCents + extrasCents);

  const missing = groups.filter(
    (group) => (selected[group.id] ?? []).length < group.min_select,
  );
  const canAdd = product.is_available && missing.length === 0;

  function handleAdd() {
    addToCart({
      storeId,
      productId: product.id,
      optionIds: chosenIds,
      quantity,
      note: note.trim() === "" ? null : note.trim(),
    });
    reportCartAdd(storeId, product.id);

    setIsOpen(false);
    reset();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!product.is_available}
        className={`flex w-full gap-4 rounded-xl border border-neutral-200 p-4 text-left transition dark:border-neutral-800 ${
          product.is_available
            ? "hover:bg-neutral-50 dark:hover:bg-neutral-900"
            : "cursor-not-allowed opacity-55"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{product.name}</h3>
            {product.is_available ? null : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                esgotado
              </span>
            )}
            {product.promotionLabel ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                {product.promotionLabel}
              </span>
            ) : null}
            {added ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                adicionado
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {product.description}
            </p>
          ) : null}

          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-medium tabular-nums">
              {formatCents(product.priceCents)}
            </span>
            {product.originalPriceCents !== null ? (
              <span className="text-sm text-neutral-400 line-through tabular-nums">
                {formatCents(product.originalPriceCents)}
              </span>
            ) : null}
          </p>
        </div>

        {product.image_url ? (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
            <Image
              src={product.image_url}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white dark:bg-neutral-950 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-semibold">{product.name}</h2>
                {product.description ? (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {product.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-col gap-6">
                {groups.map((group) => {
                  const chosen = selected[group.id] ?? [];
                  const isRequired = group.min_select >= 1;
                  const isMissing = chosen.length < group.min_select;

                  return (
                    <fieldset key={group.id}>
                      <legend className="flex w-full items-center justify-between gap-2 pb-2">
                        <span className="font-medium">{group.name}</span>
                        <span
                          className={
                            isMissing
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "text-xs text-neutral-500 dark:text-neutral-400"
                          }
                        >
                          {isRequired
                            ? group.min_select === group.max_select
                              ? `escolha ${group.min_select}`
                              : `escolha de ${group.min_select} a ${group.max_select}`
                            : `opcional, até ${group.max_select}`}
                        </span>
                      </legend>

                      <div className="flex flex-col gap-1">
                        {group.options.map((option) => {
                          const isChosen = chosen.includes(option.id);
                          const isFull =
                            !isChosen &&
                            group.max_select > 1 &&
                            chosen.length >= group.max_select;

                          return (
                            <label
                              key={option.id}
                              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                                isChosen
                                  ? "border-neutral-900 dark:border-neutral-200"
                                  : "border-neutral-200 dark:border-neutral-800"
                              } ${isFull ? "opacity-50" : "cursor-pointer"}`}
                            >
                              <input
                                type={group.max_select === 1 ? "radio" : "checkbox"}
                                name={group.id}
                                checked={isChosen}
                                disabled={isFull}
                                onChange={() => toggleOption(group, option.id)}
                                className="size-4"
                              />
                              <span className="flex-1 text-sm">{option.name}</span>
                              {option.price_delta_cents !== 0 ? (
                                <span className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                                  {option.price_delta_cents > 0 ? "+" : "−"}{" "}
                                  {formatCents(Math.abs(option.price_delta_cents))}
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}

                <label className="flex flex-col gap-1.5">
                  <span className="font-medium">Observação</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    maxLength={200}
                    placeholder="Ponto da carne, troco, ponto de referência…"
                    className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                  className="px-3 py-2 text-lg leading-none disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="w-6 text-center tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="Aumentar quantidade"
                  className="px-3 py-2 text-lg leading-none"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                className="flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {missing.length > 0
                  ? `Escolha ${missing[0].name.toLowerCase()}`
                  : `Adicionar · ${formatCents(unitCents * quantity)}`}
              </button>
            </div>

            {!storeIsOpen ? (
              <p className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                A loja está fechada agora. Você pode montar o pedido e enviar
                quando ela abrir.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
