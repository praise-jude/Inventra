-- Stock status was comparing qty_on_hand against each product's own
-- reorder_level instead of fixed thresholds, so a product with e.g. 130 units
-- on hand but reorder_level 200 was shown as "low stock". Replace it with the
-- intended fixed thresholds: 0 = out of stock, 1-5 = low stock, 6+ = in stock.
-- Postgres doesn't support altering a generated column's expression in place,
-- so drop and recreate it (this recomputes from qty_on_hand, no data loss).
alter table products drop column status;
alter table products add column status text generated always as (
  case
    when qty_on_hand <= 0 then 'out_of_stock'
    when qty_on_hand <= 5 then 'low_stock'
    else 'in_stock'
  end
) stored;
create index products_org_status_idx on products (org_id, status);

-- Decouple "needs reordering" (still driven by each product's own
-- reorder_level) from the stock-status label, so restock alerts keep working
-- for high-reorder-level products that are now correctly labeled "in stock".
alter table products add column needs_reorder boolean generated always as (
  qty_on_hand <= reorder_level
) stored;
create index products_org_needs_reorder_idx on products (org_id) where needs_reorder;
