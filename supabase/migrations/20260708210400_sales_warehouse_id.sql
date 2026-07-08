-- Sales previously had no branch/warehouse association at all — add it so
-- a sale can optionally be scoped to the branch it was recorded at.
alter table sales add column warehouse_id uuid references warehouses (id);
create index sales_org_warehouse_idx on sales (org_id, warehouse_id);
