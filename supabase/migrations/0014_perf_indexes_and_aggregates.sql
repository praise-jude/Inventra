-- ============================================================================
-- Performance — missing indexes on frequently-filtered FK columns, and small
-- SQL aggregate functions (same style as get_kpis()/get_category_mix() in
-- 0001_init.sql) to replace query-side patterns that fetched a whole
-- unrelated table just to count/sum a handful of numbers in JS.
-- ============================================================================

create index if not exists products_org_supplier_idx on products (org_id, supplier_id);
create index if not exists products_org_warehouse_idx on products (org_id, warehouse_id);
create index if not exists debtor_payments_org_id_idx on debtor_payments (org_id);

create function get_supplier_product_counts() returns table (supplier_id uuid, count bigint)
language sql stable as $$
  select p.supplier_id, count(*) from products p
  where p.org_id = current_org_id() and p.archived_at is null and p.supplier_id is not null
  group by p.supplier_id
$$;

create function get_category_product_counts() returns table (category_id uuid, count bigint)
language sql stable as $$
  select p.category_id, count(*) from products p
  where p.org_id = current_org_id() and p.archived_at is null and p.category_id is not null
  group by p.category_id
$$;

create function get_warehouse_stock_summary() returns table (
  warehouse_id uuid, sku_count bigint, stock_value numeric, total_units bigint
)
language sql stable as $$
  select p.warehouse_id, count(*), sum(p.qty_on_hand * p.sell_price), sum(p.qty_on_hand)
  from products p
  where p.org_id = current_org_id() and p.archived_at is null and p.warehouse_id is not null
  group by p.warehouse_id
$$;

create function get_debtor_payments_total() returns numeric
language sql stable as $$
  select coalesce(sum(amount), 0) from debtor_payments where org_id = current_org_id()
$$;
