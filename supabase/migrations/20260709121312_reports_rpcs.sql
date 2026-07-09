-- ============================================================================
-- Inventra — Reports RPCs (Sales Report, Inventory Valuation, Profit & Loss).
-- Same style as the existing get_kpis()/get_daily_product_profit() functions:
-- language sql stable, filtered by current_org_id(), pushes aggregation into
-- Postgres instead of pulling raw rows into Node.
-- ============================================================================

create function get_sales_summary(p_from date, p_to date, p_warehouse_id uuid default null)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'revenue', coalesce((
      select sum(s.total) from sales s
      where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
        and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    ), 0),
    'discount', coalesce((
      select sum(s.discount_amount) from sales s
      where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
        and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    ), 0),
    'tax', coalesce((
      select sum(s.tax_amount) from sales s
      where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
        and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    ), 0),
    'sales_count', coalesce((
      select count(*) from sales s
      where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
        and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    ), 0),
    'profit', coalesce((
      select sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price))
      from stock_movements m join products p on p.id = m.product_id
      where m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
        and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
    ), 0)
  )
$$;

-- p_granularity is one of 'day'|'week'|'month'|'year' — validated app-side
-- (same trust boundary as other RPC params in this codebase).
create function get_sales_by_period(p_from date, p_to date, p_granularity text, p_warehouse_id uuid default null)
returns table (period date, revenue numeric, sales_count bigint, profit numeric)
language sql stable as $$
  with rev as (
    select date_trunc(p_granularity, s.created_at)::date as period,
           sum(s.total) as revenue,
           count(*) as sales_count
    from sales s
    where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
      and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    group by 1
  ),
  prof as (
    select date_trunc(p_granularity, m.created_at)::date as period,
           sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)) as profit
    from stock_movements m join products p on p.id = m.product_id
    where m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
      and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
    group by 1
  )
  select coalesce(rev.period, prof.period) as period,
         coalesce(rev.revenue, 0) as revenue,
         coalesce(rev.sales_count, 0) as sales_count,
         coalesce(prof.profit, 0) as profit
  from rev full outer join prof on rev.period = prof.period
  order by 1
$$;

create function get_sales_by_branch(p_from date, p_to date)
returns table (warehouse_id uuid, warehouse_name text, revenue numeric, sales_count bigint)
language sql stable as $$
  select w.id, w.name, coalesce(sum(s.total), 0), count(s.id)
  from warehouses w
  left join sales s on s.warehouse_id = w.id and s.org_id = current_org_id() and s.created_at::date between p_from and p_to
  where w.org_id = current_org_id()
  group by w.id, w.name
  order by 3 desc
$$;

create function get_sales_by_product(p_from date, p_to date, p_warehouse_id uuid default null)
returns table (product_id uuid, name text, sku text, units bigint, revenue numeric, profit numeric)
language sql stable as $$
  select p.id, p.name, p.sku,
    sum(-m.qty_delta)::bigint as units,
    sum(-m.qty_delta * coalesce(m.unit_price, p.sell_price)) as revenue,
    sum(-m.qty_delta * (coalesce(m.unit_price, p.sell_price) - p.cost_price)) as profit
  from stock_movements m
  join products p on p.id = m.product_id
  where m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
    and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
  group by p.id, p.name, p.sku
  order by revenue desc
$$;

create function get_sales_by_staff(p_from date, p_to date, p_warehouse_id uuid default null)
returns table (staff_id uuid, staff_name text, revenue numeric, sales_count bigint)
language sql stable as $$
  select s.created_by, coalesce(pr.first_name || ' ' || pr.last_name, 'Unknown'), sum(s.total), count(*)
  from sales s
  left join profiles pr on pr.id = s.created_by
  where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
    and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
  group by s.created_by, pr.first_name, pr.last_name
  order by 3 desc
$$;

-- "Inventory Value" here is the cost-basis valuation (qty * unit cost) — the
-- standard accounting meaning of "inventory valuation" — distinct from
-- expected_profit, which is the sell-vs-cost margin on hand.
create function get_inventory_valuation(p_warehouse_id uuid default null)
returns table (
  product_id uuid, name text, sku text, warehouse_id uuid, warehouse_name text,
  qty_on_hand int, cost_price numeric, sell_price numeric, inventory_value numeric, expected_profit numeric
)
language sql stable as $$
  select p.id, p.name, p.sku, p.warehouse_id, w.name,
    p.qty_on_hand, p.cost_price, p.sell_price,
    (p.qty_on_hand * p.cost_price) as inventory_value,
    (p.qty_on_hand * (p.sell_price - p.cost_price)) as expected_profit
  from products p
  left join warehouses w on w.id = p.warehouse_id
  where p.org_id = current_org_id() and p.archived_at is null
    and (p_warehouse_id is null or p.warehouse_id = p_warehouse_id)
  order by inventory_value desc
$$;

-- Operating expenses are org-wide (the `expenses` table has no branch/product
-- column), so p_warehouse_id/p_product_id only narrow revenue & COGS, not the
-- expense total — expected: branch/product P&L excludes overhead allocation.
create function get_profit_loss(p_from date, p_to date, p_warehouse_id uuid default null, p_product_id uuid default null)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'revenue', rev.revenue,
    'cogs', rev.cogs,
    'gross_profit', rev.revenue - rev.cogs,
    'operating_expenses', exp.total,
    'net_profit', (rev.revenue - rev.cogs) - exp.total,
    'margin_pct', case when rev.revenue = 0 then 0
      else round((((rev.revenue - rev.cogs) - exp.total) / rev.revenue) * 100, 2) end
  )
  from (
    select
      coalesce(sum(-m.qty_delta * coalesce(m.unit_price, p.sell_price)), 0) as revenue,
      coalesce(sum(-m.qty_delta * p.cost_price), 0) as cogs
    from stock_movements m
    join products p on p.id = m.product_id
    where m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
      and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
      and (p_product_id is null or m.product_id = p_product_id)
  ) rev
  cross join (
    select coalesce(sum(amount), 0) as total from expenses
    where org_id = current_org_id() and incurred_at between p_from and p_to
  ) exp
$$;
