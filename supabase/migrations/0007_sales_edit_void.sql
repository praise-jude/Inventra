-- ============================================================================
-- Stockwell — Sales edit + void
-- `sales`/`sale_payments` only had select/insert RLS policies, so editing or
-- deleting a recorded sale was impossible even at the DB level. Voiding is
-- implemented as a soft "voided_at" flag (matching the products.archived_at
-- soft-delete pattern) rather than a hard delete, so no new delete policy or
-- stock_movements cascade/update policy is needed — the app layer reverses a
-- voided sale's stock/revenue impact by inserting a new compensating
-- stock_movements row (type = 'sale', positive qty_delta), reusing the
-- existing stock_movements_insert policy. The ledger itself is never mutated.
-- ============================================================================

alter table sales
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

drop policy if exists sales_update on sales;
create policy sales_update on sales for update
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists sale_payments_update on sale_payments;
create policy sale_payments_update on sale_payments for update
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
