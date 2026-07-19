-- SECURITY FIX: expenses_rw allowed ANY authenticated org member to write
-- (org_id = current_org_id() with no role check), while the app layer
-- (lib/actions/expenses.ts's requireManagerOrgId) restricts every mutation
-- to owner/admin/manager. A cashier/warehouse account could bypass the UI
-- entirely by calling supabase.from('expenses') directly. This mirrors the
-- app-layer restriction exactly, so it changes nothing for legitimate
-- owner/admin/manager use.
drop policy expenses_rw on expenses;

create policy expenses_select on expenses for select
  using (org_id = current_org_id());
create policy expenses_write on expenses for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy expenses_update on expenses for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy expenses_delete on expenses for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
