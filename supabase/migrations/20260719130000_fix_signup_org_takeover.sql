-- SECURITY FIX: handle_new_user() decided "this signup is joining an
-- existing org" purely by checking whether raw_user_meta_data had an
-- org_id key. That JSON is fully attacker-controlled on the PUBLIC
-- supabase.auth.signUp() endpoint (callable with the anon key, bundled in
-- both the web and mobile clients) — anyone could call it directly with
-- { org_id: '<any org>', role: 'owner', invited_by_role: 'owner' } and,
-- combined with guard_profile_status_transitions()'s auto-promotion for
-- owner/admin-invited members, land as an active Owner of someone else's
-- organization with full RLS access to their data and billing.
--
-- The fix: only trust org_id/role/invited_by/invited_by_role/branch_id
-- from metadata when auth.users.invited_at is set. That column is a
-- Supabase-managed timestamp written exclusively by the Admin API's
-- inviteUserByEmail() (which lib/team-service.ts uses for every real
-- invite, itself gated by admin/manager role checks before it's ever
-- called) — the public signUp() endpoint never sets it and a caller can't
-- forge it via raw_user_meta_data. A forged signup now simply falls
-- through to the "create a new org, make this user its owner" branch —
-- harmless, since they only ever get their own empty org.
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
  if new.invited_at is not null and new.raw_user_meta_data ? 'org_id' then
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
