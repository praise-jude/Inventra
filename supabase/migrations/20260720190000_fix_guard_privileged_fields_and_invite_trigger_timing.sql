-- REGRESSION FIX: guard_profile_privileged_fields() lost its suspended_at
-- guard when 20260709130000_profiles_branch_assignment.sql redefined it
-- against a stale copy (same "stale redefinition" pattern as
-- handle_new_user() — see 20260720180000). Confirmed live: with the guard
-- missing, a suspended user could clear their own suspended_at via the
-- profiles_update_self RLS policy (which has no column restriction) and
-- silently un-suspend themselves — suspended_at is the actual mechanism
-- lib/queries/session.ts uses to force-sign-out a suspended user. Restores
-- the guard alongside the existing org_id/role/branch_id checks.
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
  if new.suspended_at is distinct from old.suspended_at and not is_org_admin() then
    raise exception 'only an owner or admin can suspend or reactivate a member';
  end if;
  return new;
end;
$$;

-- BUG FIX: 20260719130000_fix_signup_org_takeover.sql added an
-- `invited_at is not null` check to handle_new_user() to stop a public
-- signUp() caller from forging org_id/role metadata into an org takeover —
-- correct in principle (invited_at is exclusively GoTrue Admin-API-managed
-- and unforgeable via the public endpoint), but it assumed invited_at is
-- present in the same row image the AFTER INSERT trigger sees. Confirmed
-- live it is not: admin.inviteUserByEmail() inserts the auth.users row
-- first, then stamps invited_at via a separate UPDATE moments later. Every
-- real invite since that migration has therefore fallen through to the
-- "create a new org, become its owner" branch instead of joining the
-- intended org — confirmed against a real user
-- (royalmandigitalconcept@gmail.com, invited as 'warehouse', ended up
-- owning an empty orphan org). Fix: only act on the org_id-in-metadata
-- branch once invited_at is actually non-null; otherwise defer to the new
-- AFTER UPDATE OF invited_at trigger below, which re-fires this same
-- function once GoTrue's follow-up UPDATE lands. Direct signups are
-- unaffected — they never carry an org_id key, so that branch is
-- unambiguous and still fires immediately on INSERT.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  v_first_name text := coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'given_name',
    nullif(split_part(v_full_name, ' ', 1), ''),
    'New'
  );
  v_last_name text := coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'family_name',
    nullif(trim(substring(v_full_name from length(split_part(v_full_name, ' ', 1)) + 1)), ''),
    'User'
  );
begin
  if new.raw_user_meta_data ? 'org_id' then
    if new.invited_at is null then
      return new;
    end if;
    if exists (select 1 from profiles where id = new.id) then
      return new;
    end if;
    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
    insert into profiles (id, org_id, first_name, last_name, email, role, status, branch_id, invited_by, invited_by_role)
    values (
      new.id, v_org_id, v_first_name, v_last_name, new.email,
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cashier'),
      'invited',
      nullif(new.raw_user_meta_data ->> 'branch_id', '')::uuid,
      nullif(new.raw_user_meta_data ->> 'invited_by', '')::uuid,
      nullif(new.raw_user_meta_data ->> 'invited_by_role', '')::user_role
    );
  else
    insert into organizations (name, business_email, country, state, currency, timezone)
    values (
      coalesce(new.raw_user_meta_data ->> 'business_name', v_first_name || '''s Workspace'),
      new.raw_user_meta_data ->> 'business_email',
      new.raw_user_meta_data ->> 'country',
      new.raw_user_meta_data ->> 'state',
      coalesce(new.raw_user_meta_data ->> 'currency', 'USD'),
      coalesce(new.raw_user_meta_data ->> 'timezone', 'America/New_York')
    )
    returning id into v_org_id;

    insert into profiles (
      id, org_id, first_name, last_name, email, role, status,
      terms_accepted, terms_version, terms_accepted_at, terms_accepted_ip
    )
    values (
      new.id, v_org_id, v_first_name, v_last_name, new.email, 'owner', 'active',
      coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
      new.raw_user_meta_data ->> 'terms_version',
      case when (new.raw_user_meta_data ->> 'terms_accepted')::boolean is true then now() else null end,
      new.raw_user_meta_data ->> 'terms_accepted_ip'
    );

    insert into notification_settings (org_id) values (v_org_id);
    insert into print_settings (org_id) values (v_org_id);

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks'),
           (v_org_id, 'pos_online'), (v_org_id, 'pos_offline'), (v_org_id, 'receipt_printing');

    insert into subscriptions (org_id, status, plan_key, currency)
    values (v_org_id, 'trialing', 'trial', 'NGN');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row
  when (old.invited_at is null and new.invited_at is not null)
  execute function handle_new_user();

-- Repair the one real user this bug already affected before the fix above:
-- royalmandigitalconcept@gmail.com was invited 2026-07-19 as 'warehouse'
-- into org c7ef8a36-f92f-4233-a76d-771409ca114c but ended up owning an
-- empty orphan org ("peter's Workspace") instead. Move them into the
-- intended org/role (status set directly to 'active' rather than
-- 'invited', since they already confirmed their email and had already
-- been using the app for a day under the wrong org — no reason to force a
-- redundant accept-invite step), then retire the now-empty orphan org.
alter table profiles disable trigger profiles_guard_privileged_fields;

update profiles
set org_id = 'c7ef8a36-f92f-4233-a76d-771409ca114c',
    role = 'warehouse',
    status = 'active',
    invited_by = '1fe3e752-425f-42f0-9165-b0d67fe9f54d',
    invited_by_role = 'owner'
where id = '999606eb-f641-44cb-8a60-8a2d0b4db1fe';

alter table profiles enable trigger profiles_guard_privileged_fields;

delete from organizations where id = '16e8cf07-fe2a-4967-85ce-8145fcb67b9b';
