-- ============================================================================
-- Inventra — real Paystack-backed subscription billing.
-- Replaces the fake organizations.plan / changePlan() system: a 6-day
-- card-required free trial, then NGN monthly/yearly plans billed and
-- auto-renewed via Paystack Subscriptions. organizations.plan is kept as a
-- denormalized display cache (Sidebar's "{plan} plan" text keeps working
-- unmodified) — subscriptions is the real source of truth from here on.
-- ============================================================================

create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'payment_failed', 'cancelled', 'expired', 'suspended'
);
create type billing_interval as enum ('monthly', 'yearly');
create type payment_attempt_status as enum ('success', 'failed', 'pending');

-- One row per org, seeded by handle_new_user() below (mirrors the
-- notification_settings/print_settings singleton-per-org pattern).
-- trial_ends_at stays null until the onboarding plan+card step completes —
-- that "awaiting card" limbo is distinct from an actually-running trial.
create table subscriptions (
  org_id uuid primary key references organizations (id) on delete cascade,
  status subscription_status not null default 'trialing',
  plan_key text not null default 'trial',
  billing_interval billing_interval,
  amount numeric(12,2),
  currency text not null default 'NGN',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_reminders_sent int not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_plan_code text,
  authorization_code text,
  card_brand text,
  card_last4 text,
  card_exp_month text,
  card_exp_year text,
  card_bank text,
  failed_payment_count int not null default 0,
  last_payment_attempt_at timestamptz,
  last_payment_error text,
  next_retry_at timestamptz,
  grandfathered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_status_trial_ends_idx on subscriptions (status, trial_ends_at);
create index subscriptions_status_period_end_idx on subscriptions (status, current_period_end);
create index subscriptions_next_retry_idx on subscriptions (next_retry_at) where next_retry_at is not null;

create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

-- Append-only ledger of every charge attempt (verification, recurring,
-- manual retry) — feeds the dunning ladder and the Billing page's history.
create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  invoice_id uuid references invoices (id) on delete set null,
  attempt_number int not null default 1,
  status payment_attempt_status not null,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  paystack_reference text,
  failure_reason text,
  attempted_at timestamptz not null default now()
);
create index payment_attempts_org_id_idx on payment_attempts (org_id, attempted_at desc);

-- Raw webhook payload log + delivery-retry idempotency guard. Service-role
-- only (RLS enabled, zero policies) — same pattern as signup_attempts.
create table paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  reference text,
  org_id uuid references organizations (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);
create unique index paystack_webhook_events_dedupe_idx
  on paystack_webhook_events (event_type, reference) where reference is not null;
alter table paystack_webhook_events enable row level security;

-- Extend the existing (previously unused) invoices table into the real
-- SaaS-billing history feed for the Billing page.
alter table invoices
  add column paystack_reference text,
  add column plan_key text,
  add column billing_interval billing_interval,
  add column period_start date,
  add column period_end date,
  add column paid_at timestamptz;

alter table subscriptions enable row level security;
alter table payment_attempts enable row level security;

create policy subscriptions_select on subscriptions for select
  using (org_id = current_org_id());
create policy subscriptions_update_admin on subscriptions for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());
-- No insert policy: rows are created only by handle_new_user() (security
-- definer) or the backfill below; the app never inserts a row directly —
-- all subscription state changes after that go through the service-role
-- webhook/cron routes (updates), which bypass RLS entirely.

create policy payment_attempts_select on payment_attempts for select
  using (org_id = current_org_id());
-- No insert/update policy: written exclusively by the webhook/cron routes
-- via the service-role admin client.

-- handle_new_user() — full body copied verbatim from
-- 20260710120000_fix_handle_new_user_regression.sql (per that migration's
-- own lesson about silently dropping fields), plus one new insert: seed a
-- subscriptions row for brand-new orgs only, never for invited teammates.
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
    insert into profiles (id, org_id, first_name, last_name, email, role, status, branch_id)
    values (
      new.id, v_org_id, v_first_name, v_last_name, new.email,
      coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cashier'),
      'invited',
      (new.raw_user_meta_data ->> 'branch_id')::uuid
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
