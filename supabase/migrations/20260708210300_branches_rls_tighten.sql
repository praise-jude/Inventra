-- Branch management (create/edit) is now owner/admin only, tightened from
-- owner/admin/manager — matches the already-admin-only warehouses_delete
-- policy. warehouses_select stays open to every org member (dropdowns,
-- product form, filters). Stock transfer between branches is a separate,
-- day-to-day inventory operation and intentionally stays manager+ — it is
-- gated in the app layer (lib/actions/warehouses.ts), not by these policies.
drop policy warehouses_insert on warehouses;
drop policy warehouses_update on warehouses;

create policy warehouses_insert on warehouses for insert
  with check (org_id = current_org_id() and is_org_admin());
create policy warehouses_update on warehouses for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());
