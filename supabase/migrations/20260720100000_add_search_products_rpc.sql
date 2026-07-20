-- Smart product search: adds description/supplier-name to what's searched
-- (previously only name/sku/barcode/brand — see lib/queries/products.ts's
-- getProductsPage), typo tolerance via pg_trgm similarity() ranking (the
-- trigram GIN indexes on name/sku/barcode/brand from
-- 20260709121240_audit_log_and_product_status.sql already exist; this is
-- the first thing to actually use similarity-based ranking instead of
-- plain ilike), plus new range filters (price, margin %, expiry date,
-- date added) the UI never had before. security invoker (default) — runs
-- with the caller's own privileges, so products/categories/suppliers RLS
-- still applies on top of the explicit org_id filter below; belt and
-- braces, not a bypass.
--
-- NOTE: the similarity()-based relevance ranking here scored genuine typos
-- too low against long product names (e.g. "Wather" vs "Bottled Water
-- 75cl" scored 0.18, diluted by the full string's trigram count) — fixed
-- in 20260720100100_fix_search_products_word_similarity.sql, kept as its
-- own migration rather than squashed since it was a real bug caught by
-- live testing, not a design change.
create or replace function search_products(
  p_search text default null,
  p_category_id uuid default null,
  p_warehouse_id uuid default null,
  p_supplier_id uuid default null,
  p_status text default null,
  p_active boolean default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_margin_pct numeric default null,
  p_max_margin_pct numeric default null,
  p_expiry_from date default null,
  p_expiry_to date default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_limit int default 25,
  p_offset int default 0
) returns table (
  id uuid,
  sku text,
  barcode text,
  name text,
  brand text,
  emoji text,
  image_url text,
  sell_price numeric,
  qty_on_hand int,
  status text,
  is_active boolean,
  warehouse_id uuid,
  category_name text,
  total_count bigint
)
language sql stable as $$
  with params as (
    select case when p_search is null or trim(p_search) = '' then null
      else replace(replace(trim(p_search), '%', '\%'), '_', '\_')
    end as term
  ),
  matched as (
    select
      p.id, p.sku, p.barcode, p.name, p.brand, p.emoji, p.image_url,
      p.sell_price, p.qty_on_hand, p.status, p.is_active, p.warehouse_id,
      c.name as category_name,
      p.created_at,
      case when p.sell_price > 0 then ((p.sell_price - p.cost_price) / p.sell_price) * 100 else 0 end as margin_pct,
      case
        when params.term is null then 1
        else greatest(
          similarity(p.name, params.term),
          similarity(p.sku, params.term),
          similarity(coalesce(p.barcode, ''), params.term),
          similarity(coalesce(p.brand, ''), params.term),
          similarity(coalesce(p.description, ''), params.term),
          similarity(coalesce(s.name, ''), params.term)
        )
      end as relevance
    from products p
    cross join params
    left join categories c on c.id = p.category_id
    left join suppliers s on s.id = p.supplier_id
    where p.org_id = current_org_id()
      and p.archived_at is null
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_warehouse_id is null or p.warehouse_id = p_warehouse_id)
      and (p_supplier_id is null or p.supplier_id = p_supplier_id)
      and (p_status is null or p.status = p_status)
      and (p_active is null or p.is_active = p_active)
      and (p_min_price is null or p.sell_price >= p_min_price)
      and (p_max_price is null or p.sell_price <= p_max_price)
      and (p_expiry_from is null or p.expiry_date >= p_expiry_from)
      and (p_expiry_to is null or p.expiry_date <= p_expiry_to)
      and (p_created_from is null or p.created_at >= p_created_from)
      and (p_created_to is null or p.created_at <= p_created_to)
      and (
        params.term is null
        or p.name ilike '%' || params.term || '%'
        or p.sku ilike '%' || params.term || '%'
        or p.barcode ilike '%' || params.term || '%'
        or p.brand ilike '%' || params.term || '%'
        or p.description ilike '%' || params.term || '%'
        or s.name ilike '%' || params.term || '%'
        or similarity(p.name, params.term) > 0.25
        or similarity(p.sku, params.term) > 0.25
      )
  )
  select id, sku, barcode, name, brand, emoji, image_url, sell_price, qty_on_hand, status, is_active, warehouse_id, category_name,
    count(*) over() as total_count
  from matched
  where (p_min_margin_pct is null or margin_pct >= p_min_margin_pct)
    and (p_max_margin_pct is null or margin_pct <= p_max_margin_pct)
  order by relevance desc, created_at desc
  limit p_limit offset p_offset;
$$;
