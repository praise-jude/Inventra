-- Profiles are self-updatable (theme, status on invite acceptance), but two
-- fields are privileged: org_id must never change, and role changes are
-- admin-only. RLS alone can't express column-level rules, so a trigger guards
-- them. (Applied to the hosted project on 2026-07-03 as
-- "0002_guard_profile_privileged_fields", before 0002_onboarding existed;
-- named 0001b here so filename order matches the applied history.)

create function guard_profile_privileged_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id <> old.org_id then
    raise exception 'org_id cannot be changed';
  end if;
  if new.role <> old.role and not is_org_admin() then
    raise exception 'only an owner or admin can change a member''s role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_fields before update on public.profiles
  for each row execute function guard_profile_privileged_fields();
