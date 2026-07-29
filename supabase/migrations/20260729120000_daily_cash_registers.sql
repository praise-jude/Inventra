-- Daily Cash Register: opening float entry, live cash position, and
-- end-of-day reconciliation, per org+branch+business day. Additive only
-- — no existing table/column touched. See lib/actions/cash-register.ts
-- (web) and src/lib/actions/cash-register.ts (mobile) for the app layer.
create table daily_cash_registers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  business_date date not null,
  status text not null default 'open' check (status in ('open','closed')),
  money_at_hand numeric(12,2) not null default 0,
  money_in_purse numeric(12,2) not null default 0,
  opening_balance numeric(12,2) not null default 0,
  -- cash_sales is a snapshot frozen at close time (live figure before
  -- that is computed on the fly from sales.method='cash', not stored).
  cash_sales numeric(12,2),
  -- other_cash_income/cash_expenses/cash_withdrawals are manual entries
  -- at close time — expenses has no warehouse_id or payment-method
  -- column, so these can't be reliably auto-computed per branch.
  other_cash_income numeric(12,2) not null default 0,
  cash_expenses numeric(12,2) not null default 0,
  cash_withdrawals numeric(12,2) not null default 0,
  expected_closing_balance numeric(12,2),
  actual_cash_count numeric(12,2),
  difference numeric(12,2),
  notes text,
  opened_by uuid references profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_by uuid references profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Prevents duplicate daily records for the same branch — no offline
  -- queue/dedup logic needed, the constraint does it for free.
  unique (org_id, warehouse_id, business_date)
);

create index daily_cash_registers_org_warehouse_idx on daily_cash_registers (org_id, warehouse_id, business_date desc);

alter table daily_cash_registers enable row level security;

-- Select is open to any org member (Staff can view today's cash per
-- spec) — narrower "view only, no edit" enforcement happens at the app
-- layer, same trust model already used by expenses/warehouses.
create policy daily_cash_registers_select on daily_cash_registers
  for select
  using (org_id = (select org_id from profiles where id = auth.uid()));

create policy daily_cash_registers_insert on daily_cash_registers
  for insert
  with check (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin','manager')
  );

create policy daily_cash_registers_update on daily_cash_registers
  for update
  using (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin','manager')
  )
  with check (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin','manager')
  );

-- No delete policy — immutable financial history, matches the
-- audit-log-style tables elsewhere in this schema.
