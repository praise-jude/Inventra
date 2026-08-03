-- ============================================================================
-- Inventra — Daily sales summary RPC, for the Audit Log's new Sales Summary
-- panel (daily + monthly totals, non-destructively added alongside the
-- existing activity trail). Same style as get_sales_summary()/
-- get_sales_by_period() in 20260709121312_reports_rpcs.sql: language sql
-- stable, filtered by current_org_id(), aggregated in Postgres.
--
-- Deliberately a new function rather than extending get_sales_by_period() —
-- the Reports page's Sales tab depends on that function's exact existing
-- return shape, and this needs one extra column (items_sold) that function
-- doesn't have. Revenue/sales_count here come from the same `sales` table
-- get_sales_summary()/get_sales_by_period() already use (sum(total)/count(*)),
-- so the new Sales Summary panel's numbers agree with Reports by construction,
-- not just by convention.
-- ============================================================================

create function get_daily_sales_summary(p_from date, p_to date)
returns table (day date, total_sales numeric, sales_count bigint, items_sold bigint)
language sql stable as $$
  with rev as (
    select s.created_at::date as day,
           sum(s.total) as total_sales,
           count(*) as sales_count
    from sales s
    where s.org_id = current_org_id() and s.created_at::date between p_from and p_to
    group by 1
  ),
  items as (
    select m.created_at::date as day,
           sum(-m.qty_delta) as items_sold
    from stock_movements m
    where m.org_id = current_org_id() and m.type = 'sale' and m.created_at::date between p_from and p_to
    group by 1
  )
  select coalesce(rev.day, items.day) as day,
         coalesce(rev.total_sales, 0) as total_sales,
         coalesce(rev.sales_count, 0) as sales_count,
         coalesce(items.items_sold, 0)::bigint as items_sold
  from rev full outer join items on rev.day = items.day
  order by 1
$$;
