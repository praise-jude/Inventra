-- ============================================================================
-- Team Management — suspend/reactivate. Added as a nullable timestamp rather
-- than a new `member_status` enum value, to avoid a breaking enum migration.
-- Display status becomes Active/Invited/Suspended derived from
-- `status` + `suspended_at`.
-- ============================================================================

alter table profiles add column if not exists suspended_at timestamptz;

-- suspended_at must be admin-only to change, same as role — otherwise the
-- existing `profiles_update_self` RLS policy would let a suspended user
-- simply un-suspend themselves.
create or replace function guard_profile_privileged_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id <> old.org_id then
    raise exception 'org_id cannot be changed';
  end if;
  if new.role <> old.role and not is_org_admin() then
    raise exception 'only an owner or admin can change a member''s role';
  end if;
  if new.suspended_at is distinct from old.suspended_at and not is_org_admin() then
    raise exception 'only an owner or admin can suspend or reactivate a member';
  end if;
  return new;
end;
$$;
