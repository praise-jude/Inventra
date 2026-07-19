-- Manager-tier invites + approval: an Admin-invited member should become
-- active immediately on accept (the Admin already vetted them), while a
-- Manager-invited member must still go through approval — today every
-- invite lands in 'awaiting_approval' regardless of who sent it, and only
-- Admin/Owner can invite or approve at all. This tracks who invited whom
-- (and that inviter's role at invite time, so a later role change to the
-- inviter doesn't retroactively change historical semantics) and moves the
-- accept-time status decision server-side instead of trusting the client.
alter table profiles
  add column invited_by uuid references auth.users (id) on delete set null,
  add column invited_by_role user_role;

-- handle_new_user — now also persists invited_by/invited_by_role from the
-- inviteUserByEmail() metadata (see lib/team-service.ts's
-- inviteMemberForContext). Only the existing-org ("invite") branch is
-- affected; the new-org signup branch is unchanged.
--
-- Also restores branch_id, which 20260716160000_team_approval_workflow.sql
-- silently dropped from this insert when it last redefined this function
-- (it was added deliberately by 20260709130000_profiles_branch_assignment.sql
-- but that create-or-replace only touched the approval-status fields and
-- pasted over the branch_id column/value pair). Every member invited since
-- that migration shipped has had branch_id left null regardless of what
-- branch was picked on the invite form.
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
    insert into organizations (name, business_email, country, state, currency)
    values (
      coalesce(new.raw_user_meta_data ->> 'business_name', v_first_name || '''s Workspace'),
      new.raw_user_meta_data ->> 'business_email',
      new.raw_user_meta_data ->> 'country',
      new.raw_user_meta_data ->> 'state',
      coalesce(new.raw_user_meta_data ->> 'currency', 'USD')
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

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks');
  end if;
  return new;
end;
$$;

-- Guards the status/approval columns the same way guard_profile_privileged_
-- fields already guards `role` — the client (accept-invite/page.tsx) still
-- just writes status='awaiting_approval' on self-accept exactly as before
-- (kept for backwards compatibility, not worth a client change), but the
-- actual target status is always computed here from invited_by_role and
-- never trusted from the client, so a Manager-invited member can't skip
-- approval by tampering with the request. Also lets Managers approve/
-- reject (not just Admins), but only while the row is awaiting_approval —
-- everything else about a profile (role, suspension, etc.) still requires
-- is_org_admin(), unchanged.
create or replace function guard_profile_status_transitions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'invited' and new.id = auth.uid() and new.status <> old.status then
    if old.invited_by_role in ('owner', 'admin') then
      new.status := 'active';
    else
      new.status := 'awaiting_approval';
    end if;
    return new;
  end if;

  if is_org_admin() then
    return new;
  end if;

  if current_user_role() = 'manager' and old.status = 'awaiting_approval' then
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

create trigger profiles_guard_status_transitions
  before update on profiles
  for each row execute function guard_profile_status_transitions();

-- Mobile's "awaiting approval" blocking screen needs its own status without
-- a second round trip — extends the existing single-query access gate
-- rather than adding a new RPC.
create or replace function get_access_gate_state() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'profile_exists', p.id is not null,
    'terms_accepted', coalesce(p.terms_accepted, false),
    'org_id', p.org_id,
    'country', o.country,
    'subscription_status', s.status,
    'trial_ends_at', s.trial_ends_at,
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'member_status', p.status
  )
  from (select auth.uid() as uid) u
  left join profiles p on p.id = u.uid
  left join organizations o on o.id = p.org_id
  left join subscriptions s on s.org_id = p.org_id
$$;
