"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "store-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Envia a foto direto do browser para o Storage, sem passar pelo servidor do
 * Next — a policy do bucket já limita o gerente à pasta da própria loja.
 *
 * O que vai para o formulário é só a URL, no input escondido. Se o lojista
 * enviar e desistir de salvar, o arquivo fica órfão no bucket; a limpeza de
 * verdade acontece quando o produto é salvo ou apagado.
 */
export function ImageUpload({
  storeId,
  name,
  defaultUrl,
}: {
  storeId: string;
  name: string;
  defaultUrl: string | null;
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
    if (file.size > MAX_BYTES) {
      setError("A imagem passou de 5 MB. Tente uma foto menor.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${storeId}/produtos/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

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
      <span className="text-sm font-medium">Foto</span>
      <input type="hidden" name={name} value={url} />

      <div className="flex items-start gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          {url ? (
            <Image
              src={url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={isUploading}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-neutral-400">
              sem foto
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
                  ? "Trocar foto"
                  : "Escolher foto"}
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
            JPG, PNG ou WebP, até 5 MB. Quadrada fica melhor.
          </p>
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
