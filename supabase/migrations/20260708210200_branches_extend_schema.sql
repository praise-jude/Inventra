-- "Branch Management" extends the existing warehouses table (already an
-- org-scoped location entity with full CRUD/RLS, referenced by
-- products.warehouse_id and stock_movements.warehouse_id) rather than adding
-- a parallel concept. The table stays named `warehouses` in Postgres to
-- avoid cascading renames — only the UI/Settings label becomes "Branches".
alter table warehouses
  add column country text,
  add column state text,
  add column phone text,
  add column status text not null default 'active' check (status in ('active', 'inactive'));
