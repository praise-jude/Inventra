-- ============================================================================
-- Inventra — live monthly revenue/profit (replaces dead monthly_stats reads)
-- monthly_stats is only ever populated with hardcoded numbers by
-- scripts/seed.ts (see 0008_daily_profit.sql's note on the same issue for
-- daily profit) — for every real org it has zero rows, so the Dashboard's
-- "Monthly profit" KPI silently showed "—" forever and the Revenue/Profit
-- trend chart was blank. This computes both live from stock_movements +
-- products.cost_price, the same pattern get_daily_product_profit() already
-- uses for "today".
-- ============================================================================

create or replace function get_monthly_revenue_profit() returns table (
  month date, revenue numeric, profit numeric
)
language sql stable as $$
  select
    date_trunc('month', m.created_at)::date as month,
    sum(-m.qty_delta * coalesce(m.unit_price, p.sell_price)) as revenue,
    sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)) as profit
  from stock_movements m
  join products p on p.id = m.product_id
  where m.org_id = current_org_id()
    and m.type = 'sale'
    and m.created_at >= date_trunc('month', now()) - interval '11 months'
  group by date_trunc('month', m.created_at)
  order by month
$$;

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
      select coalesce(sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)), 0)
      from stock_movements m join products p on p.id = m.product_id
      where m.org_id = current_org_id() and m.type = 'sale'
        and date_trunc('month', m.created_at) = date_trunc('month', now())
    ),
    'prior_monthly_profit', (
      select coalesce(sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)), 0)
      from stock_movements m join products p on p.id = m.product_id
      where m.org_id = current_org_id() and m.type = 'sale'
        and date_trunc('month', m.created_at) = date_trunc('month', now()) - interval '1 month'
    ),
    'total_inventory_cost', (
      select coalesce(sum(cost_price * qty_on_hand), 0) from products
      where org_id = current_org_id() and archived_at is null
    ),
    'total_inventory_value', (
      select coalesce(sum(sell_price * qty_on_hand), 0) from products
      where org_id = current_org_id() and archived_at is null
    ),
    'total_expected_profit', (
      select coalesce(sum((sell_price - cost_price) * qty_on_hand), 0) from products
      where org_id = current_org_id() and archived_at is null
    ),
    'total_stock_qty', (
      select coalesce(sum(qty_on_hand), 0) from products
      where org_id = current_org_id() and archived_at is null
    )
  )
$$;
