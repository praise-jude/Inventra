-- ============================================================================
-- Stockwell — Product images + barcodes
-- Adds the columns and storage bucket needed for real image upload and
-- barcode generation/scanning (previously: a decorative placeholder div for
-- images, and purely-cosmetic fake bars standing in for a barcode — neither
-- backed by any schema or storage).
-- ============================================================================

alter table products
  add column if not exists image_url text,
  add column if not exists barcode text;

-- Nullable-safe: multiple products may have no barcode yet (NULL), but any
-- barcode that IS set must be unique within the org.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_org_barcode_unique'
  ) then
    alter table products add constraint products_org_barcode_unique unique (org_id, barcode);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public bucket — reads happen directly via the public URL with no RLS
-- check. Writes are scoped so an org can only manage objects filed under its
-- own folder (path convention: `${orgId}/${filename}`).
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects for insert
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_org_id()::text);
drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects for update
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_org_id()::text)
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_org_id()::text);
drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects for delete
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_org_id()::text);
