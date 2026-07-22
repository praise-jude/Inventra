-- ============================================================================
-- Approval thresholds — require manager/admin sign-off when a cashier/manager
-- applies a discount, voids a sale, or changes a product price above a
-- configurable amount. Two new tables:
--   approval_settings  — per-org singleton (mirrors notification_settings/
--                        print_settings' exact shape and RLS pattern).
--   approval_requests  — generic, extensible pending/approved/rejected queue,
--                        one row per requested action, payload holds the
--                        proposed change so the decision-maker's session can
--                        apply it without needing the original requester's
--                        session to still be around.
-- ============================================================================

create type approval_entity_type as enum ('discount', 'void_sale', 'price_change');
create type approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table approval_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  discount_approval_enabled boolean not null default false,
  discount_threshold_pct numeric not null default 20,
  void_approval_enabled boolean not null default false,
  void_threshold_amount numeric not null default 10000,
  price_change_approval_enabled boolean not null default false,
  price_change_threshold_pct numeric not null default 20,
  updated_at timestamptz not null default now(),
  constraint approval_settings_discount_pct_check check (discount_threshold_pct >= 0 and discount_threshold_pct <= 100),
  constraint approval_settings_void_amount_check check (void_threshold_amount >= 0),
  constraint approval_settings_price_pct_check check (price_change_threshold_pct >= 0)
);
create trigger approval_settings_set_updated_at before update on approval_settings
  for each row execute function set_updated_at();

alter table approval_settings enable row level security;
create policy approval_settings_select on approval_settings for select
  using (org_id = current_org_id());
create policy approval_settings_update_admin on approval_settings for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());
-- No insert policy: rows are created only by handle_new_user() below.

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  entity_type approval_entity_type not null,
  entity_id uuid, -- sale id for void_sale, product id for price_change, null for discount (sale doesn't exist yet)
  requested_by uuid not null references profiles (id),
  requested_at timestamptz not null default now(),
  status approval_status not null default 'pending',
  payload jsonb not null, -- proposed change: line items/discount for discount, {reason} for void, {cost_price,sell_price} for price_change
  reason text,
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  rejected_reason text
);
create index approval_requests_org_status_idx on approval_requests (org_id, status);
create index approval_requests_requester_idx on approval_requests (requested_by, status);

alter table approval_requests enable row level security;
create policy approval_requests_select on approval_requests for select
  using (org_id = current_org_id());
create policy approval_requests_insert_own on approval_requests for insert
  with check (org_id = current_org_id() and requested_by = auth.uid());
-- RLS decides who can touch a pending row (requester or manager+); the
-- trigger below decides which specific transition is actually allowed —
-- same two-part pattern as guard_profile_status_transitions().
create policy approval_requests_update on approval_requests for update
  using (org_id = current_org_id() and (is_org_admin() or current_user_role() = 'manager' or requested_by = auth.uid()))
  with check (org_id = current_org_id());

create function guard_approval_request_transitions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'pending' then
    raise exception 'This request has already been decided.';
  end if;

  if (is_org_admin() or current_user_role() = 'manager') and new.status in ('approved', 'rejected') then
    new.decided_by := auth.uid();
    new.decided_at := now();
    return new;
  end if;

  if new.requested_by = auth.uid() and new.status = 'cancelled' then
    return new;
  end if;

  raise exception 'You are not allowed to make this change to this approval request.';
end;
$$;

create trigger approval_requests_guard_transitions
  before update on approval_requests
  for each row execute function guard_approval_request_transitions();

alter publication supabase_realtime add table approval_requests;

-- Seed a default (all-disabled) approval_settings row for every existing org
-- — additive, changes nothing until an admin turns a toggle on.
insert into approval_settings (org_id)
select id from organizations
on conflict (org_id) do nothing;

-- Extend handle_new_user() to seed approval_settings for new orgs too, same
-- as every other per-org settings table. Full body carried over unchanged
-- from 20260720190000_fix_guard_privileged_fields_and_invite_trigger_timing.sql
-- plus the one new insert, per that migration's own lesson about copying the
-- CURRENT function body exactly rather than an out-of-date snapshot.
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
