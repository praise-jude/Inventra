-- Branch comparison report: one row per branch with revenue/profit/expenses/
-- stock value for a date range, so Admin/Owner can spot the top/lowest
-- performing branch at a glance instead of switching get_sales_summary's
-- p_warehouse_id filter one branch at a time. Reuses the exact same
-- revenue/profit formulas as get_sales_summary()
-- (20260726113301_gate_reports_rpcs_behind_premium.sql) and the exact same
-- stock-value formula as get_warehouse_stock_summary()
-- (20260708121400_perf_indexes_and_aggregates.sql), just grouped by branch
-- in one query instead of filtered to one — same consistency goal as the
-- Sales Summary work reusing Reports' formulas.
--
-- Not security definer, same as get_sales_summary — relies on the caller's
-- own RLS on sales/stock_movements/expenses/products (branch-scoped for
-- Cashier/Warehouse/branch-code Manager roles), with an explicit org_id
-- filter as a defensive belt-and-braces measure. The app layer restricts
-- this report to Admin/Owner only (lib/queries/reports.ts), since a
-- branch-scoped caller would otherwise see zeros for every branch but
-- their own rather than a real comparison.
create or replace function get_branch_performance_report(p_from date, p_to date)
returns table (
  warehouse_id uuid,
  branch_name text,
  revenue numeric,
  profit numeric,
  expenses numeric,
  stock_value numeric,
  sku_count bigint
)
language sql stable as $$
  select
    w.id,
    w.name,
    coalesce(sales_agg.revenue, 0),
    coalesce(profit_agg.profit, 0),
    coalesce(expense_agg.expenses, 0),
    coalesce(stock_agg.stock_value, 0),
    coalesce(stock_agg.sku_count, 0)
  from warehouses w
  left join lateral (
    select sum(s.total) as revenue
    from sales s
    where s.warehouse_id = w.id and s.org_id = current_org_id() and s.created_at::date between p_from and p_to
  ) sales_agg on true
  left join lateral (
    select sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)) as profit
    from stock_movements m join products p on p.id = m.product_id
    where m.warehouse_id = w.id and m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
  ) profit_agg on true
  left join lateral (
    select sum(e.amount) as expenses
    from expenses e
    where e.warehouse_id = w.id and e.org_id = current_org_id() and e.incurred_at between p_from and p_to
  ) expense_agg on true
  left join lateral (
    select count(*) as sku_count, sum(p.qty_on_hand * p.sell_price) as stock_value
    from products p
    where p.warehouse_id = w.id and p.org_id = current_org_id() and p.archived_at is null
  ) stock_agg on true
  where w.org_id = current_org_id() and org_is_premium()
  order by w.name
$$;
