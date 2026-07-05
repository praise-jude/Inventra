-- ============================================================================
-- Stockwell — Daily per-product profit
-- The dashboard's "monthly_profit" KPI reads from the static monthly_stats
-- table (only ever populated with hardcoded numbers by scripts/seed.ts) —
-- there was no real, live-computed profit anywhere. This RPC computes actual
-- daily profit per product straight from the stock_movements ledger and
-- products.cost_price, using the same sum(-qty_delta * ...) convention as
-- get_kpis()/get_top_sellers() so it stays consistent with existing revenue
-- math and automatically nets out same-day voided sales (voidSale() inserts
-- a compensating type='sale' row with the opposite qty_delta).
-- ============================================================================

create or replace function get_daily_product_profit(p_date date default current_date) returns table (
  product_id uuid, name text, emoji text, units_sold bigint, revenue numeric, cost numeric, profit numeric
)
language sql stable as $$
  select p.id, p.name, p.emoji,
    sum(-sm.qty_delta) as units_sold,
    sum(-sm.qty_delta * sm.unit_price) as revenue,
    sum(-sm.qty_delta * p.cost_price) as cost,
    sum(-sm.qty_delta * (sm.unit_price - p.cost_price)) as profit
  from stock_movements sm
  join products p on p.id = sm.product_id
  where sm.org_id = current_org_id() and sm.type = 'sale' and sm.created_at::date = p_date
  group by p.id, p.name, p.emoji
  having sum(-sm.qty_delta) <> 0
  order by profit desc
$$;
