-- Invoices feature (new, from scratch — the existing `invoices` table +
-- `invoice_status` enum are Paystack billing receipts, a different
-- concept; hence `customer_invoice_status` here). Standalone from Sales
-- (no stock movement) and Debtors (no payment ledger, just a status enum)
-- — a formal document: customer + line items + due date + status.
create type customer_invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

create table customer_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  invoice_number text not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  status customer_invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, invoice_number)
);
create index customer_invoices_org_status_idx on customer_invoices (org_id, status);
create index customer_invoices_org_created_idx on customer_invoices (org_id, created_at desc);

create trigger customer_invoices_set_updated_at before update on customer_invoices
  for each row execute function set_updated_at();

create table customer_invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references customer_invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);
create index customer_invoice_items_invoice_idx on customer_invoice_items (invoice_id);

alter table customer_invoices enable row level security;
alter table customer_invoice_items enable row level security;

create policy customer_invoices_select on customer_invoices for select
  using (org_id = current_org_id());
create policy customer_invoices_insert on customer_invoices for insert
  with check (org_id = current_org_id()
    and (org_is_premium() or (select count(*) from customer_invoices where org_id = current_org_id()) < free_plan_limit('invoices')));
create policy customer_invoices_update on customer_invoices for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy customer_invoices_delete on customer_invoices for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

create policy customer_invoice_items_select on customer_invoice_items for select
  using (org_id = current_org_id());
create policy customer_invoice_items_insert on customer_invoice_items for insert
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy customer_invoice_items_update on customer_invoice_items for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));
create policy customer_invoice_items_delete on customer_invoice_items for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

-- Extend the Phase F entitlements helpers with the 5th resource.
create or replace function free_plan_limit(p_metric text) returns integer
language sql immutable as $$
  select case p_metric
    when 'products' then 50
    when 'sales' then 500
    when 'expenses' then 100
    when 'debtors' then 100
    when 'invoices' then 20
    else 0
  end
$$;

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
    'invoice_count', (select count(*) from customer_invoices where org_id = p.org_id),
    'product_limit', free_plan_limit('products'),
    'sales_limit', free_plan_limit('sales'),
    'expense_limit', free_plan_limit('expenses'),
    'debtor_limit', free_plan_limit('debtors'),
    'invoice_limit', free_plan_limit('invoices')
  )
  from (select auth.uid() as uid) u
  left join profiles p on p.id = u.uid
  left join subscriptions s on s.org_id = p.org_id
$$;
