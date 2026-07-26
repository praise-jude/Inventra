-- ============================================================================
-- Phase F — Free / Premium plan system. Replaces the mandatory 6-day
-- card-required trial with a perpetual Free tier (usage-limited, no card)
-- plus an opt-in Premium upgrade via the existing Paystack machinery.
-- Tier is derived, not a new column: premium = plan_key <> 'free' AND
-- status = 'active'. No new tables/columns — subscriptions already has
-- everything needed.
-- ============================================================================

-- One place the Free-tier limits live, referenced by both RLS and the
-- entitlements RPC below.
create or replace function free_plan_limit(p_metric text) returns integer
language sql immutable as $$
  select case p_metric
    when 'products' then 50
    when 'sales' then 500
    when 'expenses' then 100
    when 'debtors' then 100
    else 0
  end
$$;

-- Mirrors is_org_admin()'s exact pattern.
create or replace function org_is_premium(p_org_id uuid default current_org_id())
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan_key <> 'free' and status = 'active' from subscriptions where org_id = p_org_id),
    false
  )
$$;

-- Mirrors get_access_gate_state()'s pattern — one round trip for tier +
-- live usage counts + limits, callable identically from web and mobile.
create or replace function get_org_entitlements() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'org_id', p.org_id,
    'tier', case when org_is_premium(p.org_id) then 'premium' else 'free' end,
    'plan_key', s.plan_key,
    'status', s.status,
    'product_count', (select count(*) from products where org_id = p.org_id and archived_at is null),
    'sales_count', (select count(*) from sales where org_id = p.org_id),
    'expense_count', (select count(*) from expenses where org_id = p.org_id),
    'debtor_count', (select count(*) from debtors where org_id = p.org_id),
    'product_limit', free_plan_limit('products'),
    'sales_limit', free_plan_limit('sales'),
    'expense_limit', free_plan_limit('expenses'),
    'debtor_limit', free_plan_limit('debtors')
  )
  from (select auth.uid() as uid) u
  left join profiles p on p.id = u.uid
  left join subscriptions s on s.org_id = p.org_id
$$;

-- handle_new_user() — full body copied verbatim from the function's
-- current live definition (fetched via pg_get_functiondef immediately
-- before writing this migration, not from a stale snapshot — see prior
-- migrations' own notes about why that matters). Only change: a
-- brand-new org's subscriptions row starts as Free/active, not
-- trialing/trial — no card, no forced onboarding gate.
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
$$;

-- One-time backfill: grandfather every existing org onto Premium
-- permanently, EXCEPT the one org that's already genuinely, actively
-- paying (status='active', plan_key in monthly/yearly, not already
-- grandfathered) — that one is left completely untouched, its real
-- Paystack subscription keeps renewing normally.
update subscriptions
set status = 'active',
    grandfathered = true,
    plan_key = case when plan_key in ('monthly', 'yearly') then plan_key else 'legacy' end,
    current_period_start = coalesce(current_period_start, now()),
    current_period_end = greatest(coalesce(current_period_end, now()), now() + interval '100 years'),
    cancel_at_period_end = false,
    updated_at = now()
where not (status = 'active' and plan_key in ('monthly', 'yearly') and grandfathered = false);

-- ---------------------------------------------------------------------------
-- RLS: count-limited creates (org_is_premium() OR under the Free limit).
-- ---------------------------------------------------------------------------
alter policy products_insert on products
  with check (org_id = current_org_id() and has_permission('inventory', 'create')
    and (org_is_premium() or (select count(*) from products where org_id = current_org_id() and archived_at is null) < free_plan_limit('products')));

alter policy sales_insert on sales
  with check (org_id = current_org_id()
    and (org_is_premium() or (select count(*) from sales where org_id = current_org_id()) < free_plan_limit('sales')));

alter policy expenses_write on expenses
  with check (org_id = current_org_id() and current_user_role() = any (array['owner'::user_role, 'admin'::user_role, 'manager'::user_role])
    and (org_is_premium() or (select count(*) from expenses where org_id = current_org_id()) < free_plan_limit('expenses')));

alter policy debtors_insert on debtors
  with check (org_id = current_org_id()
    and (org_is_premium() or (select count(*) from debtors where org_id = current_org_id()) < free_plan_limit('debtors')));

-- ---------------------------------------------------------------------------
-- RLS: pure Premium-only locks (inventory edit/delete, branch management,
-- audit log, team role-permission management).
-- ---------------------------------------------------------------------------
alter policy products_update on products
  using (org_id = current_org_id() and has_permission('inventory', 'edit') and org_is_premium())
  with check (org_id = current_org_id() and has_permission('inventory', 'edit') and org_is_premium());

alter policy products_delete on products
  using (org_id = current_org_id() and has_permission('inventory', 'delete') and org_is_premium());

alter policy warehouses_insert on warehouses
  with check (org_id = current_org_id() and is_org_admin() and org_is_premium());

alter policy warehouses_update on warehouses
  using (org_id = current_org_id() and is_org_admin() and org_is_premium())
  with check (org_id = current_org_id() and is_org_admin() and org_is_premium());

alter policy warehouses_delete on warehouses
  using (org_id = current_org_id() and is_org_admin() and org_is_premium());

alter policy audit_logs_select on audit_logs
  using (org_id = current_org_id() and is_org_admin() and org_is_premium());

alter policy role_permissions_write_admin on role_permissions
  using (org_id = current_org_id() and is_org_admin() and org_is_premium())
  with check (org_id = current_org_id() and is_org_admin() and org_is_premium());
