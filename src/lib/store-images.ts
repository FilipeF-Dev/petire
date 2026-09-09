import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export const STORE_IMAGES_BUCKET = "store-images";

const PUBLIC_PREFIX = `/storage/v1/object/public/${STORE_IMAGES_BUCKET}/`;

/**
 * Extrai o caminho dentro do bucket a partir da URL pública, mas só devolve se
 * o arquivo for mesmo da loja informada.
 *
 * `image_url` é uma coluna de texto livre — nada impede que ela aponte para
 * fora do bucket, ou para a pasta de outra loja. Sem essa checagem, apagar um
 * produto poderia apagar a foto do vizinho.
 */
export function storeImagePath(storeId: string, url: string): string | null {
  const index = url.indexOf(PUBLIC_PREFIX);
  if (index === -1) return null;

  const path = decodeURIComponent(url.slice(index + PUBLIC_PREFIX.length));
  if (!path.startsWith(`${storeId}/`)) return null;

  return path;
}

export async function removeStoreImage(
  supabase: SupabaseClient<Database>,
  storeId: string,
  url: string,
): Promise<void> {
  const path = storeImagePath(storeId, url);
  if (!path) return;

  await supabase.storage.from(STORE_IMAGES_BUCKET).remove([path]);
}
