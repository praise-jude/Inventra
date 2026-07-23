-- ============================================================================
-- Referral codes — every org gets a unique, auto-generated code at creation
-- (visible in Settings for the owner to share). A new signup can optionally
-- enter someone else's code, which links the new org to the referring org
-- via referred_by_org_id. Track-only for now: no reward mechanics.
-- ============================================================================

alter table organizations add column referral_code text;
alter table organizations add column referred_by_org_id uuid references organizations (id) on delete set null;

-- Excludes 0/O/1/I/L for readability when spoken/typed aloud.
create or replace function generate_referral_code() returns text
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
    select exists(select 1 from organizations where referral_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

update organizations set referral_code = generate_referral_code() where referral_code is null;

alter table organizations alter column referral_code set not null;
create unique index organizations_referral_code_key on organizations (referral_code);
create index organizations_referred_by_org_id_idx on organizations (referred_by_org_id) where referred_by_org_id is not null;

-- Extends handle_new_user() to generate a referral_code for every new org
-- and resolve referred_by_org_id from an optional referral_code in signup
-- metadata. Full body carried over unchanged from
-- 20260722100000_approval_thresholds.sql plus these two additions, per that
-- migration's own lesson about copying the CURRENT function body exactly.
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
  v_referred_by_org_id uuid;
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
    -- Invalid/unknown codes are silently ignored (left null) rather than
    -- blocking signup — this is a soft, track-only feature, not a gate.
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
    values (v_org_id, 'trialing', 'trial', 'NGN');
  end if;
  return new;
end;
$$;

-- Read: any org member can see their own org's code/referral count. Write:
-- nobody — referral_code is system-generated, referred_by_org_id is
-- system-resolved at signup, neither should ever be app-writable.
create policy organizations_select_referral on organizations for select
  using (id = current_org_id() or referred_by_org_id = current_org_id());
