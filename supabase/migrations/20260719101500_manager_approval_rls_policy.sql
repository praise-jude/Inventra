-- The BEFORE UPDATE trigger (guard_profile_status_transitions, from
-- manager_approval_workflow) only governs which VALUES a Manager can write
-- once a row is reachable — it doesn't make the row reachable in the first
-- place. profiles_update_admin requires is_org_admin() (false for a
-- Manager) and profiles_update_self only covers a user's own row, so a
-- Manager's approve/reject UPDATE on someone else's row was being silently
-- dropped by RLS before the trigger ever ran (0 rows matched, no error).
-- This is the missing "can touch this row" half; the trigger stays the
-- "what values are allowed" half.
create policy profiles_update_manager_approval on profiles for update
  using (org_id = current_org_id() and current_user_role() = 'manager' and status = 'awaiting_approval')
  with check (org_id = current_org_id());
