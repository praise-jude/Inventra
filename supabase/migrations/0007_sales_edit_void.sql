-- ============================================================================
-- Stockwell — Sales edit + delete
-- `sales`/`sale_payments` only had select/insert RLS policies, so editing or
-- deleting a recorded sale was impossible even at the DB level.
--
-- NOTE: this file was rewritten to match what is actually deployed (applied
-- directly against the project as migration "0008_sales_mutations",
-- independent of this repo's migration files). The live design is a true
-- hard delete, not the soft "voided_at" flag originally drafted here:
-- deleting a sale's stock_movements rows fires a new AFTER DELETE trigger
-- (reverse_stock_movement) that restores qty_on_hand, then the sales row
-- itself is deleted, cascading to sale_payments via its existing
-- `on delete cascade` foreign key. Application code has been aligned to
-- this reality rather than the other way around.
-- ============================================================================

drop policy if exists sales_update on sales;
create policy sales_update on sales for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy if exists sales_delete on sales;
create policy sales_delete on sales for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy if exists sale_payments_update on sale_payments;
create policy sale_payments_update on sale_payments for update
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'))
  with check (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy if exists sale_payments_delete on sale_payments;
create policy sale_payments_delete on sale_payments for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

drop policy if exists stock_movements_delete on stock_movements;
create policy stock_movements_delete on stock_movements for delete
  using (org_id = current_org_id() and current_user_role() in ('owner', 'admin', 'manager'));

create or replace function reverse_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update products
     set qty_on_hand = qty_on_hand - old.qty_delta
   where id = old.product_id and org_id = old.org_id;
  return old;
end;
$$;

drop trigger if exists stock_movements_reverse on stock_movements;
create trigger stock_movements_reverse after delete on stock_movements
  for each row execute function reverse_stock_movement();
