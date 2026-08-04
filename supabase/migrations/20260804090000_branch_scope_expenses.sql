-- Follow-up to 20260803180000_branch_data_isolation.sql: expenses was
-- missed from that pass. Every other operational table (products, sales,
-- stock_movements, supply_records, debtors, customer_invoices) now has
-- branch-scoped SELECT for Cashier/Warehouse/branch-code-onboarded Manager
-- roles, but a branch-scoped user currently sees the org's entire expense
-- list regardless of branch. Same conservative design as that migration:
-- read-side (SELECT) only — warehouse_id is nullable (an expense like
-- company-wide rent may legitimately have no single branch), so a
-- write-side "warehouse_id must equal your branch" constraint would risk
-- rejecting a legitimate org-wide expense from a branch-scoped manager.

alter table expenses add column if not exists warehouse_id uuid references warehouses (id) on delete set null;
create index if not exists expenses_warehouse_idx on expenses (warehouse_id);

drop policy if exists expenses_select on expenses;
create policy expenses_select on expenses for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id = current_user_branch_scope())
  );
