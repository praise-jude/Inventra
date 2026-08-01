-- Real, cross-org platform stats for the public landing page's dynamic
-- counters. Every other function in this codebase is org-scoped via RLS;
-- this is the first that deliberately bypasses it (security definer),
-- so it's restricted to returning ONLY aggregate counts — never a row,
-- never anything attributable to a single org.
create or replace function get_public_platform_stats()
returns table (
  businesses bigint,
  products_managed bigint,
  sales_processed bigint,
  invoices_generated bigint,
  warehouses_connected bigint,
  countries_reached bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    -- "Businesses" = orgs that finished onboarding, same definition
    -- lib/supabase/middleware.ts already uses (non-null country) —
    -- excludes abandoned signups that never got past step 1.
    (select count(*) from organizations where country is not null),
    (select count(*) from products where archived_at is null),
    (select count(*) from sales),
    (select count(*) from customer_invoices),
    (select count(*) from warehouses),
    (select count(distinct country) from organizations where country is not null);
$$;

-- Mirrors the one existing "to anon" precedent in this codebase
-- (fraudshield_record_login_attempt, 20260712140212) — every other
-- function relies on default PUBLIC execute, but none of those are meant
-- to be called by a logged-out landing-page visitor.
grant execute on function get_public_platform_stats() to anon, authenticated;
