"use client";

import { useState } from "react";

import { CUISINES, cuisineLabel, sortByPopularity } from "@/lib/cuisines";
import { slugify } from "@/lib/slug";

/**
 * Os tipos de culinária da loja.
 *
 * Era um campo de texto separado por vírgula, e texto livre não casa com
 * filtro: quem escrevia "Frutos do Mar" não aparecia junto de quem escreveu
 * "frutos do mar", e a loja ficava fora de um filtro que ela deveria estar.
 * Aqui o lojista marca de uma lista, e o que ele marca é exatamente o que o
 * filtro procura.
 *
 * O campo escondido guarda a lista pronta, então o schema e o `FormState` do
 * formulário continuam vendo uma string só — nada mudou do lado do servidor.
 */
export function CuisinePicker({
  name,
  defaultValue,
  ariaLabel,
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    defaultValue
      .split(",")
      .map((tag) => slugify(tag))
      .filter(Boolean),
  );

  // Uma loja pode ter sido cadastrada com um tipo que não está no catálogo,
  // ou o catálogo pode ter mudado depois. Esses continuam marcados e
  // desmarcáveis — sumir com eles apagaria a escolha de alguém sem avisar.
  const extras = selected.filter(
    (tag) => !CUISINES.some((cuisine) => cuisine.slug === tag),
  );
  const options = [
    ...CUISINES.map((cuisine) => cuisine.slug),
    ...sortByPopularity(extras),
  ];

  function toggle(slug: string) {
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((tag) => tag !== slug)
        : // Dez é o teto do schema; passar disso seria descartado em silêncio.
          current.length >= 10
          ? current
          : [...current, slug],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={selected.join(", ")} />

      <div
        role="group"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((slug) => {
          const isOn = selected.includes(slug);

          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              aria-pressed={isOn}
              className={
                isOn
                  ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 bg-surface px-3 py-1.5 text-sm transition hover:bg-surface-hover dark:border-neutral-700"
              }
            >
              {cuisineLabel(slug)}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {selected.length === 0
          ? "É por eles que o cliente filtra."
          : `${selected.length} de 10 marcados.`}
      </p>
    </div>
  );
}
