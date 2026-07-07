-- ============================================================================
-- Dashboard — total inventory cost/value/expected-profit/stock-qty cards.
-- Folded into get_kpis() rather than a new RPC: one round trip, one source
-- of truth for "current stock" math, consistent with the existing cost/sell
-- price fields on products.
-- ============================================================================

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
      select profit from monthly_stats
      where org_id = current_org_id() order by month desc limit 1
    ),
    'prior_monthly_profit', (
      select profit from monthly_stats
      where org_id = current_org_id() order by month desc offset 1 limit 1
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
