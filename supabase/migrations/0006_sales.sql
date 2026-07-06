-- ============================================================================
-- Inventra — Sales Recording
-- Records sales as ordinary stock_movements rows (type = 'sale'), the same
-- ledger get_kpis()/get_top_sellers()/get_recent_activity() already read —
-- no RPC changes needed, revenue/best-sellers/stock update automatically.
-- sales/sale_payments/customers exist to carry the transaction-level detail
-- (customer, discount, tax, payment method) that a single stock_movements
-- row can't represent, plus a receipt to look back on.
-- ============================================================================

create type payment_method as enum ('cash', 'card', 'bank_transfer', 'mobile_money');

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
create index customers_org_id_idx on customers (org_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  customer_id uuid references customers (id),
  walk_in_name text,
  subtotal numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index sales_org_created_idx on sales (org_id, created_at desc);

-- One row per tender even for a single-method sale, so split payments later
-- (spec: "future-ready") are just >1 row here — no further migration needed.
create table sale_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  method payment_method not null,
  amount numeric(12,2) not null check (amount > 0)
);
create index sale_payments_sale_idx on sale_payments (sale_id);

alter table stock_movements add column sale_id uuid references sales (id) on delete set null;
create index stock_movements_sale_idx on stock_movements (sale_id) where sale_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — org-scoped only, matching stock_movements' existing openness. Both
-- Manager and Staff (excluding Warehouse, gated at the app layer) record
-- sales per the spec.
-- ---------------------------------------------------------------------------
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_payments enable row level security;

create policy customers_rw on customers for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy sales_select on sales for select
  using (org_id = current_org_id());
create policy sales_insert on sales for insert
  with check (org_id = current_org_id());

create policy sale_payments_select on sale_payments for select
  using (org_id = current_org_id());
create policy sale_payments_insert on sale_payments for insert
  with check (org_id = current_org_id());
