-- Branch-scoped Manager approval: today ANY Manager anywhere in the org
-- can approve/reject ANY awaiting_approval member, regardless of branch —
-- neither guard_profile_status_transitions() nor
-- profiles_update_manager_approval compare the approving Manager's branch
-- to the invitee's. This closes that gap by requiring the Manager's own
-- branch_id to match the invitee's branch_id (both must be non-null).
-- Owner/Admin (is_org_admin()) is unaffected — still a full override.
--
-- Also adds accepted_at, stamped in the same server-computed spot the
-- status transition already happens, so "time waiting since accepted"
-- can be shown accurately instead of falling back to invite-sent time.

alter table profiles add column accepted_at timestamptz;

create or replace function guard_profile_status_transitions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'invited' and new.id = auth.uid() and new.status <> old.status then
    if old.invited_by_role in ('owner', 'admin') then
      new.status := 'active';
    else
      new.status := 'awaiting_approval';
    end if;
    new.accepted_at := now();
    return new;
  end if;

  if is_org_admin() then
    return new;
  end if;

  if current_user_role() = 'manager' and old.status = 'awaiting_approval'
     and exists (
       select 1 from profiles me
       where me.id = auth.uid() and me.branch_id is not null and me.branch_id = old.branch_id
     )
  then
    return new;
  end if;

  new.status := old.status;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;
  new.rejected_at := old.rejected_at;
  new.rejected_reason := old.rejected_reason;
  return new;
end;
$$;

drop policy if exists profiles_update_manager_approval on profiles;
create policy profiles_update_manager_approval on profiles for update
  using (
    org_id = current_org_id() and current_user_role() = 'manager' and status = 'awaiting_approval'
    and branch_id is not null
    and branch_id = (select branch_id from profiles me where me.id = auth.uid())
  )
  with check (org_id = current_org_id());
