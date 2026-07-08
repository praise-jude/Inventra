-- ============================================================================
-- Warehouses — split the previously-permissive `warehouses_rw` policy so any
-- org member can read (dropdowns, product form, filters) but only
-- owner/admin/manager can create/edit, and only owner/admin can delete —
-- matching the categories/suppliers pattern from 0004_categories_suppliers.sql.
-- ============================================================================

drop policy warehouses_rw on warehouses;

create policy warehouses_select on warehouses for select
  using (org_id = current_org_id());
create policy warehouses_insert on warehouses for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy warehouses_update on warehouses for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy warehouses_delete on warehouses for delete
  using (org_id = current_org_id() and is_org_admin());
