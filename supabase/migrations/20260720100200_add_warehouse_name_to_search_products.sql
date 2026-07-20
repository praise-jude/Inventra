-- Adds warehouse_name so search_products() can also back
-- lib/queries/search.ts's searchProductsForOrg() (shared by the Command
-- Palette, Sales product picker, and Stock Adjustment picker) — those
-- three surfaces get the same typo-tolerant ranking the Products page just
-- got, instead of maintaining a second, separately-tuned search path.
drop function if exists search_products(text,uuid,uuid,uuid,text,boolean,numeric,numeric,numeric,numeric,date,date,timestamptz,timestamptz,int,int);

create function search_products(
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
  warehouse_name text,
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
      w.name as warehouse_name,
      p.created_at,
      case when p.sell_price > 0 then ((p.sell_price - p.cost_price) / p.sell_price) * 100 else 0 end as margin_pct,
      case
        when params.term is null then 1
        else greatest(
          word_similarity(params.term, p.name),
          word_similarity(params.term, p.sku),
          word_similarity(params.term, coalesce(p.barcode, '')),
          word_similarity(params.term, coalesce(p.brand, '')),
          word_similarity(params.term, coalesce(p.description, '')),
          word_similarity(params.term, coalesce(s.name, ''))
        )
      end as relevance
    from products p
    cross join params
    left join categories c on c.id = p.category_id
    left join suppliers s on s.id = p.supplier_id
    left join warehouses w on w.id = p.warehouse_id
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
        or word_similarity(params.term, p.name) > 0.3
        or word_similarity(params.term, p.sku) > 0.3
      )
  )
  select id, sku, barcode, name, brand, emoji, image_url, sell_price, qty_on_hand, status, is_active, warehouse_id, category_name, warehouse_name,
    count(*) over() as total_count
  from matched
  where (p_min_margin_pct is null or margin_pct >= p_min_margin_pct)
    and (p_max_margin_pct is null or margin_pct <= p_max_margin_pct)
  order by relevance desc, created_at desc
  limit p_limit offset p_offset;
$$;
