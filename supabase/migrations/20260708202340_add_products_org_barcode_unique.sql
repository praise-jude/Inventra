do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_org_barcode_unique'
  ) then
    alter table products add constraint products_org_barcode_unique unique (org_id, barcode);
  end if;
end
$$;
