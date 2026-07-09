-- ============================================================================
-- Inventra — Audit Log, Product Active/Inactive status, richer Stock
-- Adjustments, and search performance indexes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Product availability — distinct from the generated stock-level `status`
-- column (in_stock/low_stock/out_of_stock). Inactive products stay in the
-- database (unlike archived_at, which is a soft-delete) but are excluded
-- from Sales, search, and stock movements at the query layer.
-- ---------------------------------------------------------------------------
alter table products add column if not exists is_active boolean not null default true;
create index if not exists products_org_active_idx on products (org_id, is_active);

-- ---------------------------------------------------------------------------
-- Stock adjustment detail — the existing `reason` column stays as the canned
-- reason string; `adjustment_type` adds an explicit queryable category and
-- `notes` adds a separate freeform field, matching the "Product / Quantity /
-- Adjustment Type / Reason / Notes / User / Date / Branch" spec.
-- ---------------------------------------------------------------------------
alter table stock_movements add column if not exists adjustment_type text;
alter table stock_movements add column if not exists notes text;
alter table stock_movements add constraint stock_movements_adjustment_type_check
  check (adjustment_type is null or adjustment_type in ('increase', 'decrease', 'damaged', 'expired', 'count_correction', 'loss', 'other'));

-- ---------------------------------------------------------------------------
-- Audit log — captures product/stock/sale/team/branch/settings/auth events.
-- Immutable: only insert + select policies exist, no update/delete.
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null,
  actor_role user_role not null,
  action text not null,
  module text not null,
  entity_type text,
  entity_id uuid,
  entity_label text,
  previous_value jsonb,
  new_value jsonb,
  branch_id uuid references warehouses(id) on delete set null,
  branch_name text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on audit_logs (org_id, created_at desc);
create index audit_logs_org_module_idx on audit_logs (org_id, module);
create index audit_logs_org_actor_idx on audit_logs (org_id, actor_id);
create index audit_logs_org_entity_idx on audit_logs (org_id, entity_type, entity_id);

alter table audit_logs enable row level security;

-- Viewing the audit trail is Admin-tier only (owner/admin) per spec.
create policy audit_logs_select on audit_logs for select
  using (org_id = current_org_id() and is_org_admin());

-- Every role's actions must be logged — insert is open to any authenticated
-- org member, but only for their own org/identity, so no one can forge
-- another user's entry.
create policy audit_logs_insert on audit_logs for insert
  with check (org_id = current_org_id() and actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Search performance — trigram indexes make ilike '%term%' index-backed
-- (case-insensitive, partial match) instead of a sequential scan.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;

create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index products_sku_trgm_idx on products using gin (sku gin_trgm_ops);
create index products_barcode_trgm_idx on products using gin (barcode gin_trgm_ops) where barcode is not null;
create index products_brand_trgm_idx on products using gin (brand gin_trgm_ops) where brand is not null;

-- ---------------------------------------------------------------------------
-- Reporting query performance — stock_movements has (org_id, created_at) and
-- sales has (org_id, created_at) / (org_id, warehouse_id) already; the one
-- genuinely new composite the report RPCs need is type+date together.
-- ---------------------------------------------------------------------------
create index stock_movements_org_type_created_idx on stock_movements (org_id, type, created_at);
