-- Team invitations can now assign the new member to a branch (warehouses
-- table — see 20260708210200_branches_extend_schema.sql for why "branch" is
-- UI-only naming over the existing warehouses entity). Capture + display
-- only in this pass: no query filters by branch_id yet, mirroring role's
-- own guard pattern so a non-admin can't silently reassign their own branch.

alter table profiles
  add column branch_id uuid references warehouses (id) on delete set null;

create index profiles_branch_id_idx on profiles (branch_id);

-- Replaces guard_profile_privileged_fields() from
-- 20260708120100_guard_profile_privileged_fields.sql — same org_id/role
-- guards, plus the equivalent admin-only check for branch_id.
create or replace function guard_profile_privileged_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id <> old.org_id then
    raise exception 'org_id cannot be changed';
  end if;
  if new.role <> old.role and not is_org_admin() then
    raise exception 'only an owner or admin can change a member''s role';
  end if;
  if new.branch_id is distinct from old.branch_id and not is_org_admin() then
    raise exception 'only an owner or admin can change a member''s branch';
  end if;
  return new;
end;
$$;

-- handle_new_user() (20260708120200_onboarding.sql) — extend the invite
-- branch to also persist branch_id from invite metadata, same as role.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_first_name text := coalesce(new.raw_user_meta_data ->> 'first_name', 'New');
  v_last_name text := coalesce(new.raw_user_meta_data ->> 'last_name', 'User');
begin
  if new.raw_user_meta_data ? 'org_id' then
    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
    insert into profiles (id, org_id, first_name, last_name, email, role, status, branch_id)
    values (
      new.id, v_org_id, v_first_name, v_last_name, new.email,
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cashier'),
      'invited',
      (new.raw_user_meta_data ->> 'branch_id')::uuid
    );
  else
    insert into organizations (name) values (v_first_name || '''s Workspace')
    returning id into v_org_id;

    insert into profiles (id, org_id, first_name, last_name, email, role, status)
    values (new.id, v_org_id, v_first_name, v_last_name, new.email, 'owner', 'active');

    insert into notification_settings (org_id) values (v_org_id);

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks');
  end if;
  return new;
end;
$$;
