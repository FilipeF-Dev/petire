-- =============================================================================
-- Petire — bucket de imagens
--
-- Convenção de caminho: <store_id>/<qualquer-coisa>.<ext>
--   3f2a.../logo.webp
--   3f2a.../produtos/x-salada.webp
-- O primeiro segmento é a loja dona do arquivo. É ele que a policy checa.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Extrai o store_id do caminho. Devolve null se o primeiro segmento não for um
-- uuid — sem isso, um nome de arquivo qualquer derrubaria a policy com erro de
-- cast em vez de simplesmente negar o acesso.
create or replace function public.storage_store_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

grant execute on function public.storage_store_id(text) to anon, authenticated;

-- Leitura pública: o bucket serve as fotos do cardápio para clientes sem login.
create policy store_images_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store-images');

-- Escrita: só o gerente, e só dentro da pasta da própria loja.
create policy store_images_insert_manager on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-images'
    and public.manages_store(public.storage_store_id(name))
  );

create policy store_images_update_manager on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-images'
    and public.manages_store(public.storage_store_id(name))
  )
  with check (
    bucket_id = 'store-images'
    and public.manages_store(public.storage_store_id(name))
  );

create policy store_images_delete_manager on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-images'
    and public.manages_store(public.storage_store_id(name))
  );
