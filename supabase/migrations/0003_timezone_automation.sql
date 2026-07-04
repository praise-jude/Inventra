-- ============================================================================
-- Stockwell — timezone automation
-- handle_new_user() previously never set organizations.timezone from signup
-- metadata at all (every new business landed on the column's hardcoded
-- 'America/New_York' default regardless of country). Mirrors the existing
-- currency-from-country pattern: the app resolves the IANA zone from the
-- chosen country/state and passes it through signUp metadata; this trigger
-- just needs to persist it.
-- ============================================================================

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
    insert into profiles (id, org_id, first_name, last_name, email, role, status)
    values (
      new.id, v_org_id, v_first_name, v_last_name, new.email,
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cashier'),
      'invited'
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

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks');
  end if;
  return new;
end;
$$;
