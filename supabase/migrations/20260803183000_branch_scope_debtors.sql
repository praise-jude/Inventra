-- Follow-up to 20260803180000_branch_data_isolation.sql: that migration
-- added warehouse_id + branch-scoped SELECT to the `customers` table, but
-- `customers` has zero rows across the entire database — it's a vestigial
-- FK target for sales.customer_id, never actually populated. The real
-- "Customers" feature (DebtorsClient.tsx on web, the Customers tab on
-- mobile — credit tracking, amount owed, payments) is backed by `debtors`,
-- which this migration was missing.

alter table debtors add column if not exists warehouse_id uuid references warehouses (id) on delete set null;
create index if not exists debtors_warehouse_idx on debtors (warehouse_id);

drop policy if exists debtors_select on debtors;
create policy debtors_select on debtors for select
  using (
    org_id = current_org_id()
    and org_is_premium()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );
