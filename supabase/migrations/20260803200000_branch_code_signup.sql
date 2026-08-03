-- ============================================================================
-- Branch-code signup: an Owner generates a code for a specific branch, a
-- new user enters it at signup, and lands directly in that branch as
-- 'manager', active, no invite/approval step. This is a DIFFERENT concept
-- from organizations.referral_code (an existing org-to-org growth-referral
-- mechanic, unrelated to branch staffing) — deliberately a different
-- column/field name (branch_code, not referral_code) so the two can never
-- be confused or collide.
--
-- handle_new_user() already has exactly the branching shape this needs:
-- "org_id in metadata" -> join existing org (the Team invite path, gated
-- by invited_at so a public signUp() can never forge its way in), else
-- "no org_id" -> create a brand new org. This adds one more branch, checked
-- BEFORE the new-org fallback: if branch_code is present, look it up
-- server-side against warehouses (never trust a client-supplied org_id/
-- role directly, same reasoning as the existing referral_code lookup a few
-- lines down) and, if valid, insert a profile in that org/branch instead of
-- creating anything new. Existing behavior for both other paths is
-- untouched — this is purely an added elsif.
-- ============================================================================

alter table warehouses add column if not exists branch_code text unique;
alter table warehouses add column if not exists branch_code_expires_at timestamptz;

create or replace function generate_branch_code() returns text
language plpgsql as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_exists boolean;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1);
    end loop;
    select exists(select 1 from warehouses where branch_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
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
  v_referred_by_org_id uuid;
  v_branch_id uuid;
  v_branch_org_id uuid;
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

  elsif new.raw_user_meta_data ? 'branch_code' and trim(new.raw_user_meta_data ->> 'branch_code') <> '' then
    select id, org_id into v_branch_id, v_branch_org_id
    from warehouses
    where branch_code = upper(trim(new.raw_user_meta_data ->> 'branch_code'))
      and (branch_code_expires_at is null or branch_code_expires_at > now());
    if v_branch_id is null then
      raise exception 'Invalid or expired branch code.';
    end if;

    insert into profiles (
      id, org_id, branch_id, first_name, last_name, email, role, status,
      terms_accepted, terms_version, terms_accepted_at, terms_accepted_ip
    )
    values (
      new.id, v_branch_org_id, v_branch_id, v_first_name, v_last_name, new.email, 'manager', 'active',
      coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
      new.raw_user_meta_data ->> 'terms_version',
      case when (new.raw_user_meta_data ->> 'terms_accepted')::boolean is true then now() else null end,
      new.raw_user_meta_data ->> 'terms_accepted_ip'
    );

  else
    if new.raw_user_meta_data ? 'referral_code' and trim(new.raw_user_meta_data ->> 'referral_code') <> '' then
      select id into v_referred_by_org_id
      from organizations
      where referral_code = upper(trim(new.raw_user_meta_data ->> 'referral_code'));
    end if;

    insert into organizations (name, business_email, country, state, currency, timezone, referral_code, referred_by_org_id)
    values (
      coalesce(new.raw_user_meta_data ->> 'business_name', v_first_name || '''s Workspace'),
      new.raw_user_meta_data ->> 'business_email',
      new.raw_user_meta_data ->> 'country',
      new.raw_user_meta_data ->> 'state',
      coalesce(new.raw_user_meta_data ->> 'currency', 'USD'),
      coalesce(new.raw_user_meta_data ->> 'timezone', 'America/New_York'),
      generate_referral_code(),
      v_referred_by_org_id
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
    insert into approval_settings (org_id) values (v_org_id);

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks'),
           (v_org_id, 'pos_online'), (v_org_id, 'pos_offline'), (v_org_id, 'receipt_printing');

    insert into subscriptions (org_id, status, plan_key, currency)
    values (v_org_id, 'active', 'free', 'NGN');
  end if;
  return new;
end;
$function$;

-- Branch Managers created via branch_code should see only their own
-- branch's data, same as Cashier/Warehouse — extends
-- current_user_branch_scope() (20260803180000_branch_data_isolation.sql)
-- rather than adding a parallel check. Safe for EXISTING managers: none of
-- them have branch_id set today (verified against real data before this
-- migration), and the function already returns NULL — meaning
-- "unrestricted" — whenever branch_id is null, so this changes nothing for
-- any manager who isn't newly branch-code-onboarded.
create or replace function current_user_branch_scope() returns uuid
language sql stable as $$
  select branch_id from profiles
  where id = auth.uid() and role in ('cashier', 'warehouse', 'manager')
$$;
