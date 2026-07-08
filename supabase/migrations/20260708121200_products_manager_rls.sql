-- ============================================================================
-- Products/product_variants — `products_rw`/`product_variants_rw` were
-- `for all` with no role check, so a cashier or warehouse-role account could
-- create/edit/delete products via the existing actions. Split into a
-- read-for-everyone / write-for-manager-tier+ pattern, matching the
-- categories/suppliers/warehouses convention.
-- ============================================================================

drop policy products_rw on products;
create policy products_select on products for select
  using (org_id = current_org_id());
create policy products_insert on products for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy products_update on products for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy products_delete on products for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy product_variants_rw on product_variants;
create policy product_variants_select on product_variants for select
  using (org_id = current_org_id());
create policy product_variants_insert on product_variants for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy product_variants_update on product_variants for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy product_variants_delete on product_variants for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
