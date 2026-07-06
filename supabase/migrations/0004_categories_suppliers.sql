-- ============================================================================
-- Inventra — Categories & Suppliers management
-- Adds the contact fields the Supplier module needs, and splits the
-- previously-permissive categories/suppliers RLS so any org member can read
-- (dropdowns, POS lookups later) but only owner/admin/manager can mutate —
-- matching the v2.0 role matrix ("Manager: manage inventory",
-- "Staff: view assigned inventory").
-- ============================================================================

alter table suppliers
  add column email text,
  add column phone text,
  add column address text,
  add column company text,
  add column contact_person text;

drop policy categories_rw on categories;
create policy categories_select on categories for select
  using (org_id = current_org_id());
create policy categories_insert on categories for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy categories_update on categories for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy categories_delete on categories for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy suppliers_rw on suppliers;
create policy suppliers_select on suppliers for select
  using (org_id = current_org_id());
create policy suppliers_insert on suppliers for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy suppliers_update on suppliers for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy suppliers_delete on suppliers for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
