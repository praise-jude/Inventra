-- customer_invoice_items_insert was mistakenly restricted to owner/admin/
-- manager, contradicting the documented design ("create open to any org
-- member, matches Sales") and customer_invoices_insert's own policy (no
-- role restriction). Since createInvoice() always inserts >=1 item row
-- right after the parent invoice row, a cashier/warehouse-role create
-- would insert the invoice successfully then fail RLS on the item insert,
-- leaving an orphaned invoice with no items. Relax to match the parent:
-- org-scoped only, no role restriction. Update/delete stay manager-tier+.
drop policy customer_invoice_items_insert on customer_invoice_items;
create policy customer_invoice_items_insert on customer_invoice_items for insert
  with check (org_id = current_org_id());
