-- ============================================================================
-- Stockwell — Daily per-product profit
-- The dashboard's "monthly_profit" KPI reads from the static monthly_stats
-- table (only ever populated with hardcoded numbers by scripts/seed.ts) —
-- there was no real, live-computed profit anywhere. This RPC computes actual
-- daily profit per product straight from the stock_movements ledger and
-- products.cost_price.
--
-- NOTE: this file was rewritten to match what is actually deployed
-- (applied directly against the project as migration "0009_daily_product_profit",
-- independent of this repo's migration files). The deployed function always
-- computes for current_date (no p_date parameter) and returns a column named
-- `units`, not `units_sold` — application code has been aligned to that
-- reality rather than the other way around.
-- ============================================================================

create or replace function get_daily_product_profit() returns table (
  product_id uuid, name text, emoji text, units bigint, revenue numeric, cost numeric, profit numeric
)
language sql stable as $$
  select
    p.id,
    p.name,
    p.emoji,
    sum(-m.qty_delta)::bigint as units,
    sum(-m.qty_delta * coalesce(m.unit_price, p.sell_price)) as revenue,
    sum(-m.qty_delta * p.cost_price) as cost,
    sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)) as profit
  from stock_movements m
  join products p on p.id = m.product_id
  where m.org_id = current_org_id()
    and m.type = 'sale'
    and m.created_at::date = current_date
  group by p.id, p.name, p.emoji
  order by profit desc
$$;
