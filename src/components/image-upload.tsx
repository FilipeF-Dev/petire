"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui";
import { MAX_INPUT_BYTES, resizeImage } from "@/lib/image-resize";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "store-images";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Envia a foto direto do browser para o Storage, sem passar pelo servidor do
 * Next — a policy do bucket já limita o gerente à pasta da própria loja.
 *
 * A foto é **encolhida antes de subir** (ver src/lib/image-resize.ts). O
 * lojista fotografa com o celular e o arquivo tem 2 a 4 MB; o que fica no
 * Storage é o que ele mandou, para sempre. Encolher aqui é o que faz um
 * cardápio de 40 itens ocupar 6 MB em vez de 100.
 *
 * Por isso o limite de 5 MB do bucket deixou de ser o que se cobra do lojista:
 * o que entra já sai pequeno, e o que se recusa é só o que nem dá para abrir
 * sem travar o celular dele.
 *
 * O que vai para o formulário é só a URL, no input escondido. Se o lojista
 * enviar e desistir de salvar, o arquivo fica órfão no bucket; a limpeza de
 * verdade acontece quando o produto é salvo ou apagado.
 *
 * Serve a foto do produto, a logo e a capa. O que muda entre elas é a pasta
 * dentro do bucket e o formato do preview — e o preview importa: ele é o
 * único lugar onde o lojista descobre que a capa vai ser cortada em 3 por 1
 * antes de a loja inteira ver o resultado.
 */
export function ImageUpload({
  storeId,
  name,
  defaultUrl,
  label = "Foto",
  folder = "produtos",
  aspect = "square",
  hint = "JPG, PNG ou WebP. Pode mandar a foto do celular como está — ela é reduzida aqui antes de subir. Quadrada fica melhor.",
}: {
  storeId: string;
  name: string;
  defaultUrl: string | null;
  label?: string;
  /** Pasta dentro de `<store_id>/`. Separa a logo das fotos do cardápio. */
  folder?: string;
  /** O preview imita o recorte da tela pública: quadrado ou 3 por 1. */
  aspect?: "square" | "wide";
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Use uma imagem JPG, PNG, WebP ou AVIF.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Essa imagem é grande demais para abrir. Tente outra foto.");
      return;
    }

    setIsUploading(true);
    try {
      // Se o redimensionamento falhar — formato exótico, canvas bloqueado —
      // sobe o original. Foto pesada é melhor do que lojista sem foto.
      let upload = file;
      try {
        upload = await resizeImage(file);
      } catch {
        upload = file;
      }

      const supabase = createClient();
      const extension = upload.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // Nome sorteado, e não `logo.webp` fixo: sobrescrever mantém a URL, e a
      // URL que não muda continua servindo a imagem antiga do cache da CDN.
      const path = `${storeId}/${folder}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, upload, { contentType: upload.type, upsert: false });

      if (uploadError) {
        setError("Não foi possível enviar a imagem. Tente de novo.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setUrl(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`relative shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 ${
            aspect === "wide" ? "aspect-[3/1] w-72" : "size-24"
          }`}
        >
          {url ? (
            <Image
              src={url}
              alt=""
              fill
              sizes={aspect === "wide" ? "288px" : "96px"}
              className="object-cover"
              unoptimized={isUploading}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-neutral-400">
              sem imagem
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isUploading}
              onClick={() => fileInput.current?.click()}
            >
              {isUploading
                ? "Enviando…"
                : url
                  ? `Trocar ${label.toLowerCase()}`
                  : `Escolher ${label.toLowerCase()}`}
            </Button>

            {url ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isUploading}
                onClick={() => setUrl("")}
              >
                Remover
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {hint}
          </p>
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
