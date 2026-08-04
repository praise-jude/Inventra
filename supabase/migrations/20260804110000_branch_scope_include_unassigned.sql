-- Bug fix: branch-scoped SELECT policies (20260803180000_branch_data_isolation.sql,
-- 20260803183000_branch_scope_debtors.sql, 20260804090000_branch_scope_expenses.sql)
-- hid any row with warehouse_id = null from Cashier/Warehouse/branch-code
-- Manager entirely, instead of treating "unassigned" as shared/company-wide
-- stock. In production, 88 of 142 products (62%) have no warehouse_id —
-- warehouse_id has always been optional on product/sale inserts (the New
-- Sale form literally labels it "Branch (optional)") — so branch staff
-- lost the ability to see or sell most of the catalog. Every branch-scoped
-- SELECT policy now also shows warehouse_id is null rows, in addition to
-- the user's own branch; Owner/Admin/unscoped-Manager visibility
-- (current_user_branch_scope() is null) is unchanged.

drop policy if exists products_select on products;
create policy products_select on products for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists sales_select on sales;
create policy sales_select on sales for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists stock_movements_select on stock_movements;
create policy stock_movements_select on stock_movements for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists supply_records_select on supply_records;
create policy supply_records_select on supply_records for select
  using (
    org_id = current_org_id()
    and (is_org_admin() or current_user_role() = 'manager' or has_permission('supply_records', 'view'))
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists customers_select on customers;
create policy customers_select on customers for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists customer_invoices_select on customer_invoices;
create policy customer_invoices_select on customer_invoices for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists debtors_select on debtors;
create policy debtors_select on debtors for select
  using (
    org_id = current_org_id()
    and org_is_premium()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );

drop policy if exists expenses_select on expenses;
create policy expenses_select on expenses for select
  using (
    org_id = current_org_id()
    and (current_user_branch_scope() is null or warehouse_id is null or warehouse_id = current_user_branch_scope())
  );
