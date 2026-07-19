-- SECURITY FIX: createProduct/updateProduct accepted negative cost_price/
-- sell_price/reorder_level with no server-side validation anywhere — the
-- web Server Action and mobile's direct-Supabase write both have the same
-- gap, and client-side Zod validation is trivially bypassed by calling
-- Supabase directly. A DB CHECK constraint closes this for both apps and
-- any other client at once, regardless of which layer is bypassed.
alter table products
  add constraint products_cost_price_non_negative check (cost_price >= 0),
  add constraint products_sell_price_non_negative check (sell_price >= 0),
  add constraint products_reorder_level_non_negative check (reorder_level >= 0);
