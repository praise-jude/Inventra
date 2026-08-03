-- ============================================================================
-- Branch data isolation (read-side). Today `profiles.branch_id` is purely
-- decorative for data-access purposes — every RLS policy in this schema
-- filters only by org_id, so a Cashier/Warehouse-role user assigned to one
-- branch can currently see every other branch's products, sales, stock
-- movements, customers, and invoices too. This adds the actual restriction,
-- for Cashier and Warehouse roles only — Owner/Admin/Manager keep today's
-- org-wide visibility (Manager already assumes org-wide access in Reports/
-- Debtors/Expenses; changing that would be a breaking behavior change for
-- every org's existing managers, not something this migration touches).
--
-- Design: current_user_branch_scope() returns NULL (meaning "no
-- restriction, see everything in the org") for anyone who isn't
-- Cashier/Warehouse, AND for a Cashier/Warehouse who hasn't been assigned a
-- branch yet — checked against real data before writing this: most
-- Cashier/Warehouse profiles today have branch_id = null, and a naive
-- "warehouse_id = their branch_id" filter would evaluate to
-- "warehouse_id = null", which never matches anything in SQL — that would
-- have silently zeroed out every list for those users the moment this
-- shipped. Restriction only actually applies once an org assigns a branch
-- to a Cashier/Warehouse profile.
--
-- Deliberately read-side (SELECT) only in this pass — warehouse_id is
-- optional on sales/products inserts throughout the app today (e.g. the
-- New Sale form labels it "Branch (optional)"), so a hard write-side
-- "warehouse_id must equal your branch" check would reject legitimate
-- transactions from a branch-scoped cashier who doesn't explicitly pick
-- their branch. The app layer now pre-fills and locks that field for
-- Cashier/Warehouse users instead (see lib/actions/customers.ts,
-- lib/actions/sales.ts) so new records get tagged correctly going forward,
-- without a DB-level constraint that could reject valid writes today.
--
-- Dashboard KPIs, Reports, and the Audit Log's Sales Summary all read
-- through these same tables via plain (non-security-definer) SQL
-- functions — none of them need any changes, this cascades automatically.

create or replace function current_user_branch_scope() returns uuid
language sql stable as $$
  select branch_id from profiles
  where id = auth.uid() and role in ('cashier', 'warehouse')
$$;

-- customers/customer_invoices have no warehouse_id today — nullable and
-- additive, existing rows/inserts are unaffected until the app starts
-- populating it.
alter table customers add column if not exists warehouse_id uuid references warehouses (id) on delete set null;
alter table customer_invoices add column if not exists warehouse_id uuid references warehouses (id) on delete set null;
create index if not exists customers_warehouse_idx on customers (warehouse_id);
create index if not exists customer_invoices_warehouse_idx on customer_invoices (warehouse_id);

drop policy if exists products_select on products;
create policy products_select on products for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists sales_select on sales;
create policy sales_select on sales for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists stock_movements_select on stock_movements;
create policy stock_movements_select on stock_movements for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists supply_records_select on supply_records;
create policy supply_records_select on supply_records for select
  using (
    org_id = current_org_id()
    and (is_org_admin() or current_user_role() = 'manager' or has_permission('supply_records', 'view'))
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists customers_rw on customers;
create policy customers_select on customers for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );
create policy customers_insert on customers for insert
  with check (org_id = current_org_id());
create policy customers_update on customers for update
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
create policy customers_delete on customers for delete
  using (org_id = current_org_id());

drop policy if exists customer_invoices_select on customer_invoices;
create policy customer_invoices_select on customer_invoices for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );
