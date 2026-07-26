-- Product-spec update: stricter free-tier limits, and Debtors ("Customer
-- Management" in the updated spec) moves from a count-limited resource to
-- a full Premium lock -- same pattern as audit_logs_select's
-- org_is_premium() gate -- rather than a free-tier cap. This resolves a
-- contradiction in the spec (it listed "Customer Management" as fully
-- Premium-only while also giving "Debt Records" a free count limit); the
-- hard-lock reading was chosen explicitly.

create or replace function free_plan_limit(p_metric text) returns integer
language sql immutable as $$
  select case p_metric
    when 'products' then 20
    when 'sales' then 300
    when 'expenses' then 10
    when 'invoices' then 10
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
    'invoice_count', (select count(*) from customer_invoices where org_id = p.org_id),
    'product_limit', free_plan_limit('products'),
    'sales_limit', free_plan_limit('sales'),
    'expense_limit', free_plan_limit('expenses'),
    'invoice_limit', free_plan_limit('invoices')
  )
  from (select auth.uid() as uid) u
  left join profiles p on p.id = u.uid
  left join subscriptions s on s.org_id = p.org_id
$$;

-- Debtors ("Customers" in the nav) -- full Premium lock on every action,
-- not just create. Data is never deleted, just hidden from Free-tier
-- access via RLS (identical treatment to audit_logs_select).
drop policy debtors_select on debtors;
create policy debtors_select on debtors for select
  using (org_id = current_org_id() and org_is_premium());

drop policy debtors_insert on debtors;
create policy debtors_insert on debtors for insert
  with check (org_id = current_org_id() and org_is_premium());

drop policy debtors_update on debtors;
create policy debtors_update on debtors for update
  using (org_id = current_org_id() and org_is_premium())
  with check (org_id = current_org_id() and org_is_premium());

drop policy debtors_delete on debtors;
create policy debtors_delete on debtors for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin') and org_is_premium());

drop policy debtor_payments_select on debtor_payments;
create policy debtor_payments_select on debtor_payments for select
  using (org_id = current_org_id() and org_is_premium());

drop policy debtor_payments_insert on debtor_payments;
create policy debtor_payments_insert on debtor_payments for insert
  with check (org_id = current_org_id() and org_is_premium());
