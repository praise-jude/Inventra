-- ============================================================================
-- Stockwell — Debtors & Expenses modules
-- Debtors mirrors the existing stock_movements ledger pattern: a mutable
-- running balance (debtors.amount_owed) plus an append-only payment ledger,
-- kept in sync by a trigger — same shape as products.qty_on_hand +
-- stock_movements + apply_stock_movement(). Expenses is a simple ledger.
-- get_kpis() is updated so expenses reduce the displayed monthly profit.
-- ============================================================================

create type debtor_status as enum ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled');

create table debtors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  customer_name text not null,
  phone text,
  email text,
  notes text,
  amount_owed numeric(12,2) not null default 0,
  due_date date,
  status debtor_status not null default 'pending',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index debtors_org_id_idx on debtors (org_id);
create index debtors_org_status_idx on debtors (org_id, status);

create trigger debtors_set_updated_at before update on debtors
  for each row execute function set_updated_at();

create table debtor_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  debtor_id uuid not null references debtors (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references profiles (id)
);
create index debtor_payments_debtor_idx on debtor_payments (debtor_id, paid_at desc);

create function apply_debtor_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_remaining numeric(12,2);
  v_status debtor_status;
begin
  select greatest(amount_owed - new.amount, 0), status into v_remaining, v_status
    from debtors where id = new.debtor_id;

  update debtors
     set amount_owed = v_remaining,
         status = (case
           when v_status = 'cancelled' then 'cancelled'
           when v_remaining <= 0 then 'paid'
           else 'partially_paid'
         end)::debtor_status,
         updated_at = now()
   where id = new.debtor_id and org_id = new.org_id;
  return new;
end;
$$;

create trigger debtor_payments_apply after insert on debtor_payments
  for each row execute function apply_debtor_payment();

create type expense_category as enum
  ('rent', 'salary', 'transport', 'utilities', 'inventory_purchase', 'logistics', 'miscellaneous');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  category expense_category not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  incurred_at date not null default current_date,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index expenses_org_incurred_idx on expenses (org_id, incurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table debtors enable row level security;
alter table debtor_payments enable row level security;
alter table expenses enable row level security;

create policy debtors_select on debtors for select
  using (org_id = current_org_id());
create policy debtors_insert on debtors for insert
  with check (org_id = current_org_id());
create policy debtors_update on debtors for update
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
create policy debtors_delete on debtors for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin'));

create policy debtor_payments_select on debtor_payments for select
  using (org_id = current_org_id());
create policy debtor_payments_insert on debtor_payments for insert
  with check (org_id = current_org_id());

create policy expenses_rw on expenses for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Expenses reduce the displayed monthly profit.
-- ---------------------------------------------------------------------------
create or replace function get_kpis() returns jsonb
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
      select profit - coalesce((
        select sum(amount) from expenses
        where org_id = current_org_id()
          and date_trunc('month', incurred_at) = date_trunc('month', current_date)
      ), 0)
      from monthly_stats
      where org_id = current_org_id() order by month desc limit 1
    ),
    'prior_monthly_profit', (
      select profit from monthly_stats
      where org_id = current_org_id() order by month desc offset 1 limit 1
    )
  )
$$;
