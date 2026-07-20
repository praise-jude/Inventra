-- REGRESSION FIX (3rd occurrence of this exact pattern — see
-- 20260710120000_fix_handle_new_user_regression.sql for the prior one):
-- 20260719130000_fix_signup_org_takeover.sql redefined handle_new_user()
-- against a stale copy of the function to add its invited_at security
-- check, silently dropping fields restored by later migrations in
-- between: the print_settings row, the pos_online/pos_offline/
-- receipt_printing integrations (20260708121700_print_settings.sql), and
-- critically the subscriptions row insert
-- (20260710130000_billing_subscriptions.sql). Confirmed live: every real
-- signup since 2026-07-19 has had NO subscriptions row at all, and
-- get_access_gate_state() left-joins subscriptions, so subscription_status
-- comes back null — the middleware's block/awaiting-card checks all
-- require a truthy status, so these orgs got full, permanent, unrestricted
-- app access with no trial, no card prompt, and no billing enforcement
-- ever. This restores every field while keeping the invited_at security
-- fix intact.
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

-- Backfill the real orgs this regression already broke (created since
-- 2026-07-19, before this fix): "peter's Workspace" and "St Patrick".
insert into subscriptions (org_id, status, plan_key, currency)
select o.id, 'trialing', 'trial', 'NGN'
from organizations o
left join subscriptions s on s.org_id = o.id
where s.org_id is null
on conflict (org_id) do nothing;

insert into print_settings (org_id)
select id from organizations
on conflict (org_id) do nothing;

insert into integrations (org_id, provider)
select o.id, p.provider::integration_provider
from organizations o
cross join (values ('stripe'), ('paystack'), ('quickbooks'), ('slack'), ('google_drive'), ('webhooks'), ('pos_online'), ('pos_offline'), ('receipt_printing')) as p(provider)
on conflict (org_id, provider) do nothing;
