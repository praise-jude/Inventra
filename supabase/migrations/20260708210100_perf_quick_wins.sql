-- Performance quick wins: a missing index for the Products list's default
-- sort, and two SQL aggregates (same style as get_supplier_product_counts()/
-- get_warehouse_stock_summary() in 20260708121400_perf_indexes_and_aggregates.sql)
-- replacing query-side code that fetched a whole table just to reduce/bucket
-- it in JS.

create index if not exists products_org_created_idx on products (org_id, created_at desc);

create function get_inventory_cards() returns table (
  current_stock bigint, reserved bigint, damaged bigint, returned bigint, expiring bigint
)
language sql stable as $$
  select
    coalesce(sum(qty_on_hand), 0),
    coalesce(sum(qty_reserved), 0),
    coalesce(sum(qty_damaged), 0),
    coalesce(sum(qty_returned), 0),
    count(*) filter (where expiry_date is not null and expiry_date <= current_date + 7)
  from products
  where org_id = current_org_id() and archived_at is null
$$;

create function get_monthly_sales_volume() returns table (month date, count bigint)
language sql stable as $$
  select date_trunc('month', created_at)::date, count(*)
  from sales
  where org_id = current_org_id()
    and created_at >= date_trunc('month', now()) - interval '11 months'
  group by 1
  order by 1
$$;
