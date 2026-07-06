-- ============================================================================
-- Inventra — initial schema
-- Multi-tenant by org_id (denormalized onto every table so RLS policies are
-- flat, single-column predicates with no joins).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('owner', 'admin', 'manager', 'cashier', 'warehouse');
create type member_status as enum ('active', 'invited');
create type movement_type as enum ('received', 'sale', 'adjustment', 'transfer', 'return', 'expired');
create type invoice_status as enum ('paid', 'pending', 'failed');
create type integration_provider as enum ('stripe', 'paystack', 'quickbooks', 'slack', 'google_drive', 'webhooks');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  timezone text not null default 'America/New_York',
  tax_rate numeric(5,2) not null default 0,
  support_email text,
  plan text not null default 'starter',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  role user_role not null,
  status member_status not null default 'invited',
  theme_preference text not null default 'system',
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on profiles (org_id);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  address text,
  manager_profile_id uuid references profiles (id),
  capacity int,
  created_at timestamptz not null default now()
);
create index warehouses_org_id_idx on warehouses (org_id);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index suppliers_org_id_idx on suppliers (org_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  emoji text,
  unique (org_id, name)
);
create index categories_org_id_idx on categories (org_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  category_id uuid references categories (id),
  warehouse_id uuid references warehouses (id),
  supplier_id uuid references suppliers (id),
  name text not null,
  description text,
  emoji text,
  brand text,
  sku text not null,
  unit text not null default 'each',
  cost_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  reorder_level int not null default 0,
  qty_on_hand int not null default 0,
  qty_reserved int not null default 0,
  qty_damaged int not null default 0,
  qty_returned int not null default 0,
  expiry_date date,
  batch_number text,
  status text generated always as (
    case
      when qty_on_hand <= 0 then 'out_of_stock'
      when qty_on_hand <= reorder_level then 'low_stock'
      else 'in_stock'
    end
  ) stored,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, sku)
);
create index products_org_id_idx on products (org_id);
create index products_org_status_idx on products (org_id, status);
create index products_org_category_idx on products (org_id, category_id);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  sku_suffix text,
  price_delta numeric(12,2) not null default 0,
  qty_on_hand int not null default 0
);
create index product_variants_product_id_idx on product_variants (product_id);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  warehouse_id uuid references warehouses (id),
  type movement_type not null,
  qty_delta int not null,
  unit_price numeric(12,2),
  reason text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index stock_movements_org_created_idx on stock_movements (org_id, created_at desc);
create index stock_movements_product_idx on stock_movements (product_id, created_at desc);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  invoice_number text not null,
  amount numeric(12,2) not null,
  status invoice_status not null,
  issued_at date not null
);
create index invoices_org_id_idx on invoices (org_id);

create table monthly_stats (
  org_id uuid not null references organizations (id) on delete cascade,
  month date not null,
  revenue numeric(12,2) not null,
  profit numeric(12,2) not null,
  primary key (org_id, month)
);

create table notification_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  low_stock boolean not null default true,
  out_of_stock boolean not null default true,
  expiring_products boolean not null default true,
  new_purchase_orders boolean not null default true,
  weekly_digest boolean not null default false
);

create table integrations (
  org_id uuid not null references organizations (id) on delete cascade,
  provider integration_provider not null,
  status text not null default 'not_connected',
  connected_at timestamptz,
  primary key (org_id, provider)
);

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Stock movement ledger keeps products.qty_on_hand in sync.
-- Seed baseline quantities at 0 and let movement history be the source of
-- truth, so there is exactly one place quantity is ever set from.
-- ---------------------------------------------------------------------------
create function apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update products
     set qty_on_hand = qty_on_hand + new.qty_delta
   where id = new.product_id and org_id = new.org_id;
  return new;
end;
$$;

create trigger stock_movements_apply after insert on stock_movements
  for each row execute function apply_stock_movement();

-- ---------------------------------------------------------------------------
-- New auth.users row -> organization + profile, atomically (same transaction
-- as the auth.users insert, so the two can never be separated by a
-- crash/network blip between two independent API calls).
-- ---------------------------------------------------------------------------
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_first_name text := coalesce(new.raw_user_meta_data ->> 'first_name', 'New');
  v_last_name text := coalesce(new.raw_user_meta_data ->> 'last_name', 'User');
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
    insert into organizations (name) values (v_first_name || '''s Workspace')
    returning id into v_org_id;

    insert into profiles (id, org_id, first_name, last_name, email, role, status)
    values (new.id, v_org_id, v_first_name, v_last_name, new.email, 'owner', 'active');

    insert into notification_settings (org_id) values (v_org_id);

    insert into integrations (org_id, provider)
    values (v_org_id, 'stripe'), (v_org_id, 'paystack'), (v_org_id, 'quickbooks'),
           (v_org_id, 'slack'), (v_org_id, 'google_drive'), (v_org_id, 'webhooks');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions — SECURITY DEFINER is required so that a policy on
-- `profiles` calling these doesn't recurse into evaluating RLS on `profiles`
-- again to answer its own query.
-- ---------------------------------------------------------------------------
create function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function is_org_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('owner', 'admin'), false)
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table warehouses enable row level security;
alter table suppliers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table stock_movements enable row level security;
alter table invoices enable row level security;
alter table monthly_stats enable row level security;
alter table notification_settings enable row level security;
alter table integrations enable row level security;

create policy organizations_select on organizations for select
  using (id = current_org_id());
create policy organizations_update on organizations for update
  using (id = current_org_id() and is_org_admin())
  with check (id = current_org_id() and is_org_admin());

create policy profiles_select on profiles for select
  using (org_id = current_org_id() or id = auth.uid());
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_update_admin on profiles for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());

create policy warehouses_rw on warehouses for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy suppliers_rw on suppliers for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy categories_rw on categories for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy products_rw on products for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy product_variants_rw on product_variants for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy stock_movements_select on stock_movements for select
  using (org_id = current_org_id());
create policy stock_movements_insert on stock_movements for insert
  with check (org_id = current_org_id());

create policy invoices_select on invoices for select
  using (org_id = current_org_id());

create policy monthly_stats_select on monthly_stats for select
  using (org_id = current_org_id());

create policy notification_settings_select on notification_settings for select
  using (org_id = current_org_id());
create policy notification_settings_update on notification_settings for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());

create policy integrations_select on integrations for select
  using (org_id = current_org_id());
create policy integrations_update on integrations for update
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());

-- ---------------------------------------------------------------------------
-- Dashboard aggregate functions (SECURITY INVOKER — the default — so RLS on
-- the underlying tables is enforced using the calling user's own session).
-- ---------------------------------------------------------------------------
create function get_kpis() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'total_products', (select count(*) from products where org_id = current_org_id() and archived_at is null),
    'low_stock_count', (select count(*) from products where org_id = current_org_id() and archived_at is null and status = 'low_stock'),
    'out_of_stock_count', (select count(*) from products where org_id = current_org_id() and archived_at is null and status = 'out_of_stock'),
    'active_suppliers', (select count(*) from suppliers where org_id = current_org_id()),
    'today_revenue', (
      select coalesce(sum(-qty_delta * unit_price), 0) from stock_movements
      where org_id = current_org_id() and type = 'sale' and created_at::date = current_date
    ),
    'yesterday_revenue', (
      select coalesce(sum(-qty_delta * unit_price), 0) from stock_movements
      where org_id = current_org_id() and type = 'sale' and created_at::date = current_date - 1
    ),
    'monthly_profit', (
      select profit from monthly_stats
      where org_id = current_org_id() order by month desc limit 1
    ),
    'prior_monthly_profit', (
      select profit from monthly_stats
      where org_id = current_org_id() order by month desc offset 1 limit 1
    )
  )
$$;

create function get_category_mix() returns table (name text, value numeric, pct numeric)
language sql stable as $$
  with vals as (
    select coalesce(c.name, 'Uncategorized') as name, sum(p.qty_on_hand * p.sell_price) as value
    from products p left join categories c on c.id = p.category_id
    where p.org_id = current_org_id() and p.archived_at is null
    group by c.name
  ), total as (select sum(value) as t from vals)
  select vals.name, vals.value,
    round(100 * vals.value / nullif((select t from total), 0), 1) as pct
  from vals order by vals.value desc
$$;

create function get_top_sellers(p_limit int default 5) returns table (
  product_id uuid, name text, emoji text, units bigint, revenue numeric, trend_pct numeric
)
language sql stable as $$
  with recent as (
    select product_id, sum(-qty_delta) as units, sum(-qty_delta * unit_price) as revenue
    from stock_movements
    where org_id = current_org_id() and type = 'sale' and created_at >= now() - interval '30 days'
    group by product_id
  ), prior as (
    select product_id, sum(-qty_delta) as units
    from stock_movements
    where org_id = current_org_id() and type = 'sale'
      and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'
    group by product_id
  )
  select p.id, p.name, p.emoji, recent.units, recent.revenue,
    round(100.0 * (recent.units - coalesce(prior.units, 0)) / nullif(coalesce(prior.units, recent.units), 0), 0) as trend_pct
  from recent
  join products p on p.id = recent.product_id
  left join prior on prior.product_id = recent.product_id
  order by recent.revenue desc
  limit p_limit
$$;

create function get_stock_health() returns table (label text, count bigint)
language sql stable as $$
  select 'in_stock', count(*) from products where org_id = current_org_id() and archived_at is null and status = 'in_stock'
  union all
  select 'low_stock', count(*) from products where org_id = current_org_id() and archived_at is null and status = 'low_stock'
  union all
  select 'out_of_stock', count(*) from products where org_id = current_org_id() and archived_at is null and status = 'out_of_stock'
  union all
  select 'expiring', count(*) from products where org_id = current_org_id() and archived_at is null
    and expiry_date is not null and expiry_date <= current_date + 7
$$;
