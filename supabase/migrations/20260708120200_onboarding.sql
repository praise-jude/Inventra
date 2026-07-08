-- ============================================================================
-- Inventra — onboarding & authentication extensions
-- Adds business location/contact fields, a terms-of-service acceptance audit
-- trail, and a service-role-only signup rate-limit table. Extends
-- handle_new_user() to persist the new signup fields without changing the
-- existing invite branch or the org creator's role.
-- ============================================================================

alter table organizations
  add column business_email text,
  add column country text,
  add column state text;

alter table profiles
  add column terms_accepted boolean not null default false,
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column terms_accepted_ip text;

-- ---------------------------------------------------------------------------
-- Signup rate limiting — written/read only by the service-role admin client
-- (RLS enabled, zero policies), so anon/authenticated sessions can never see
-- or tamper with attempt counts.
-- ---------------------------------------------------------------------------
create table signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);
create index signup_attempts_ip_created_idx on signup_attempts (ip, created_at desc);
alter table signup_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- handle_new_user — now also persists business/location/terms fields
-- collected at signup. The invite branch (existing org) is unchanged. The
-- new-org branch derives first/last name from either explicit metadata
-- (email/password signup) or Google's OAuth profile fields, and always
-- grants the org creator 'owner' — the "role" picked on the signup form is
-- collected for UX only and is intentionally never used to set this row,
-- since the business creator must always retain full billing/delete rights
-- over the workspace they just created.
-- ---------------------------------------------------------------------------
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
