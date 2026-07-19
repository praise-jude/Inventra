-- Customizable per-module permission overrides for Manager/Cashier/
-- Warehouse — Owner/Admin stay hardcoded full-access (never customizable,
-- enforced by the CHECK constraint below, not just hidden in the UI). This
-- is additive: has_permission()'s fallback (no override row) reproduces
-- today's real RLS-enforced behavior exactly, verified against the live
-- policies before writing this — see the 9 policies rewritten below, which
-- are the only ones this migration touches out of ~87 in the schema.
create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  role user_role not null,
  module text not null,
  action text not null,
  allowed boolean not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, role, module, action),
  constraint role_permissions_role_check check (role in ('manager', 'cashier', 'warehouse'))
);
create index role_permissions_org_role_idx on role_permissions (org_id, role);
alter table role_permissions enable row level security;

create policy role_permissions_select on role_permissions for select
  using (org_id = current_org_id());
create policy role_permissions_write_admin on role_permissions for all
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());

-- Fallback branch is a direct port of today's actual enforced behavior
-- (RLS + Server Action gates), NOT what the app code superficially looks
-- like it does — e.g. sales/edit has no app-layer check today but IS
-- blocked by RLS for cashier, so the fallback matches the RLS reality.
create function has_permission(p_module text, p_action text) returns boolean
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
  end if;

  return false;
end;
$$;

-- The 9 policies this phase touches — everything else in the schema is
-- untouched. Each replaces its inline current_user_role() in (...) check
-- with has_permission(), whose fallback above reproduces the exact same
-- check, so this changes nothing until an org admin writes an override.

drop policy products_insert on products;
create policy products_insert on products for insert
  with check (org_id = current_org_id() and has_permission('inventory', 'create'));
drop policy products_update on products;
create policy products_update on products for update
  using (org_id = current_org_id() and has_permission('inventory', 'edit'))
  with check (org_id = current_org_id() and has_permission('inventory', 'edit'));
drop policy products_delete on products;
create policy products_delete on products for delete
  using (org_id = current_org_id() and has_permission('inventory', 'delete'));

drop policy stock_movements_insert on stock_movements;
create policy stock_movements_insert on stock_movements for insert
  with check (org_id = current_org_id() and has_permission('inventory', 'create_movement'));
drop policy stock_movements_delete on stock_movements;
create policy stock_movements_delete on stock_movements for delete
  using (org_id = current_org_id() and has_permission('inventory', 'delete_movement'));

drop policy sales_update on sales;
create policy sales_update on sales for update
  using (org_id = current_org_id() and has_permission('sales', 'edit'))
  with check (org_id = current_org_id() and has_permission('sales', 'edit'));
drop policy sales_delete on sales;
create policy sales_delete on sales for delete
  using (org_id = current_org_id() and has_permission('sales', 'delete'));

drop policy sale_payments_update on sale_payments;
create policy sale_payments_update on sale_payments for update
  using (org_id = current_org_id() and has_permission('sales', 'edit'))
  with check (org_id = current_org_id() and has_permission('sales', 'edit'));
drop policy sale_payments_delete on sale_payments;
create policy sale_payments_delete on sale_payments for delete
  using (org_id = current_org_id() and has_permission('sales', 'delete'));
