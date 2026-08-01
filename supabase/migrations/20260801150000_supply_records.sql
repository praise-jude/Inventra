-- Supply Records: record every supplier delivery (multi-product, quantity +
-- unit cost), with a pending/received/verified/cancelled workflow where
-- only received/verified affects stock. Mirrors sales' proven shape (a
-- header table + line items that get mirrored into the existing
-- stock_movements ledger so the EXISTING apply_stock_movement() trigger
-- updates qty_on_hand for free, and every existing reporting RPC picks
-- them up automatically) rather than inventing a parallel stock-update
-- mechanism — the only difference from sales is that supply_record_items
-- lives in its own table first (since a pending supply must NOT touch
-- stock yet), and gets mirrored into stock_movements only at the moment
-- of the pending->received/verified transition.
--
-- Deliberately does NOT touch products.cost_price on receipt — no
-- weighted-average-cost logic exists anywhere in this codebase today, and
-- guessing at one risks corrupting a field every KPI/report reads.
-- unit_cost is captured per line for Supply Records' own reporting only.

do $$ begin
  create type supply_status as enum ('pending', 'received', 'verified', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists supply_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  reference_number text not null,
  supplier_id uuid references suppliers (id) on delete set null,
  supplier_name text not null,
  supplier_phone text,
  supplier_email text,
  invoice_number text,
  warehouse_id uuid not null references warehouses (id),
  date_supplied date not null,
  status supply_status not null default 'pending',
  total_quantity numeric not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  verified_by uuid references profiles (id) on delete set null,
  verified_at timestamptz,
  cancelled_by uuid references profiles (id) on delete set null,
  cancelled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, reference_number)
);
create index if not exists supply_records_org_status_idx on supply_records (org_id, status);
create index if not exists supply_records_org_supplier_idx on supply_records (org_id, supplier_id);
create index if not exists supply_records_org_date_idx on supply_records (org_id, date_supplied);
drop trigger if exists supply_records_set_updated_at on supply_records;
create trigger supply_records_set_updated_at before update on supply_records
  for each row execute function set_updated_at();

create table if not exists supply_record_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  supply_record_id uuid not null references supply_records (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists supply_record_items_supply_idx on supply_record_items (supply_record_id);
create index if not exists supply_record_items_product_idx on supply_record_items (product_id);

alter table stock_movements add column if not exists supply_record_id uuid references supply_records (id) on delete set null;

-- Mirrors sales' reuse of stock_movements for the actual inventory event.
-- Fires only on the real pending->stocked or stocked->cancelled
-- transitions — a pending->verified skip-past-received, or a
-- received->verified upgrade, never double-inserts, since v_was_stocked
-- is already true in the latter case. Cancelling an already-stocked
-- supply reverses it with an offsetting negative movement, so
-- qty_on_hand never silently drifts from what a "cancelled" delivery
-- already added to the shelf.
create or replace function apply_supply_record_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_was_stocked boolean := old.status in ('received', 'verified');
  v_now_stocked boolean := new.status in ('received', 'verified');
begin
  if v_now_stocked and not v_was_stocked then
    insert into stock_movements (org_id, product_id, warehouse_id, type, qty_delta, unit_price, supply_record_id, created_by, reason)
    select new.org_id, i.product_id, new.warehouse_id, 'received', i.quantity, i.unit_cost, new.id, auth.uid(),
           'Supply ' || new.reference_number
    from supply_record_items i
    where i.supply_record_id = new.id;
  elsif v_was_stocked and not v_now_stocked then
    insert into stock_movements (org_id, product_id, warehouse_id, type, qty_delta, unit_price, supply_record_id, created_by, reason)
    select new.org_id, i.product_id, new.warehouse_id, 'received', -i.quantity, i.unit_cost, new.id, auth.uid(),
           'Reversal — supply ' || new.reference_number || ' cancelled'
    from supply_record_items i
    where i.supply_record_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists supply_records_apply_status_change on supply_records;
create trigger supply_records_apply_status_change
  after update of status on supply_records
  for each row execute function apply_supply_record_status_change();

-- Reuses the existing, previously-unused notification_settings.new_purchase_orders
-- toggle (already present since init.sql, never wired to anything until now)
-- instead of adding a new column for the on/off switch; adds only the one
-- genuinely new field this feature needs.
alter table notification_settings add column if not exists large_supply_threshold_amount numeric;

alter table supply_records enable row level security;
alter table supply_record_items enable row level security;

-- Select is broadly gated through has_permission() so "Staff can view only
-- if granted" is enforced at the DB layer, not just hidden in the UI —
-- this data (supplier identity, unit costs) is more sensitive than most
-- has_permission()-gated modules, so the check lives directly in RLS
-- rather than only as an app-level route guard.
drop policy if exists supply_records_select on supply_records;
create policy supply_records_select on supply_records for select
  using (org_id = current_org_id() and (is_org_admin() or current_user_role() = 'manager' or has_permission('supply_records', 'view')));
drop policy if exists supply_records_insert on supply_records;
create policy supply_records_insert on supply_records for insert
  with check (org_id = current_org_id() and (is_org_admin() or current_user_role() = 'manager'));
drop policy if exists supply_records_update on supply_records;
create policy supply_records_update on supply_records for update
  using (org_id = current_org_id() and (is_org_admin() or current_user_role() = 'manager'))
  with check (org_id = current_org_id());
-- No delete policy — soft delete only (deleted_at), matches audit_logs-style
-- immutable-history tables elsewhere in the schema.

drop policy if exists supply_record_items_select on supply_record_items;
create policy supply_record_items_select on supply_record_items for select
  using (exists (
    select 1 from supply_records r
    where r.id = supply_record_id and r.org_id = current_org_id()
      and (is_org_admin() or current_user_role() = 'manager' or has_permission('supply_records', 'view'))
  ));
drop policy if exists supply_record_items_insert on supply_record_items;
create policy supply_record_items_insert on supply_record_items for insert
  with check (exists (
    select 1 from supply_records r
    where r.id = supply_record_id and r.org_id = current_org_id()
      and (is_org_admin() or current_user_role() = 'manager')
  ));
-- Items can only be removed while the parent record is still pending
-- (mirrors "Edit Pending Supplies" — once received/verified/cancelled,
-- the line items become part of an immutable stock/audit trail).
drop policy if exists supply_record_items_delete on supply_record_items;
create policy supply_record_items_delete on supply_record_items for delete
  using (exists (
    select 1 from supply_records r
    where r.id = supply_record_id and r.org_id = current_org_id()
      and (is_org_admin() or current_user_role() = 'manager') and r.status = 'pending'
  ));

-- Extends has_permission() with one new elsif branch — the rest of this
-- function body is copied verbatim from 20260719120000_role_permissions.sql
-- (confirmed via migration history that it's the only migration to have
-- ever defined this function, so this is its current live body), per the
-- discipline established in 20260801140000_branch_scoped_manager_approval.sql
-- of amending the real current function rather than a stale snapshot.
create or replace function has_permission(p_module text, p_action text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role user_role;
  v_org_id uuid;
  v_override boolean;
begin
  select role, org_id into v_role, v_org_id from profiles where id = auth.uid();
  if v_role is null then return false; end if;
  if v_role in ('owner', 'admin') then return true; end if;

  select allowed into v_override
  from role_permissions
  where org_id = v_org_id and role = v_role and module = p_module and action = p_action;

  if v_override is not null then
    return v_override;
  end if;

  if p_module = 'inventory' then
    if p_action in ('view', 'export', 'create_movement') then return true; end if;
    return v_role = 'manager';
  elsif p_module = 'sales' then
    if p_action = 'view' then return v_role in ('manager', 'cashier'); end if;
    if p_action = 'create' then return v_role in ('manager', 'cashier'); end if;
    return v_role = 'manager';
  elsif p_module = 'reports' then
    return v_role = 'manager';
  elsif p_module = 'supply_records' then
    return v_role = 'manager';
  end if;

  return false;
end;
$$;
