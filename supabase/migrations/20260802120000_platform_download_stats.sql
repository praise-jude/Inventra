-- Real download-count tracking for the public /download page and the
-- landing page's Stats counters. Only ever holds one row per platform
-- (currently just 'android' — the only real download today) with a plain
-- integer counter, no per-visitor rows, nothing to leak. Written to be
-- safely re-runnable from any partial prior state.
create table if not exists platform_download_stats (
  platform text primary key,
  download_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into platform_download_stats (platform, download_count)
values ('android', 0)
on conflict (platform) do nothing;

-- Enable RLS with no policies: blocks all direct PostgREST access. The
-- table is only ever touched through the two security-definer functions
-- below, which bypass RLS entirely (they run as the function owner).
alter table platform_download_stats enable row level security;

-- Atomic increment, callable by a logged-out visitor clicking the APK
-- download button — the only "write" a public marketing page does in
-- this codebase, hence security definer + explicit anon grant (same
-- precedent as get_public_platform_stats() and fraudshield_*).
create or replace function increment_platform_download(p_platform text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  insert into platform_download_stats (platform, download_count, updated_at)
  values (p_platform, 1, now())
  on conflict (platform) do update
    set download_count = platform_download_stats.download_count + 1, updated_at = now()
  returning download_count into v_count;
  return v_count;
end;
$$;

grant execute on function increment_platform_download(text) to anon, authenticated;

-- Extend the public stats function with a real Android download count so
-- the landing page can show it alongside the other real counters in one
-- fetch. Return signature changed (new output column) — create or replace
-- can't do that for a `returns table` function, so drop + recreate.
-- coalesce wraps the WHOLE subquery (not just the column) so a missing
-- row — not just a null value — still reads as a real 0.
drop function if exists get_public_platform_stats();

create function get_public_platform_stats()
returns table (
  businesses bigint,
  products_managed bigint,
  sales_processed bigint,
  invoices_generated bigint,
  warehouses_connected bigint,
  countries_reached bigint,
  android_downloads bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from organizations where country is not null),
    (select count(*) from products where archived_at is null),
    (select count(*) from sales),
    (select count(*) from customer_invoices),
    (select count(*) from warehouses),
    (select count(distinct country) from organizations where country is not null),
    coalesce((select download_count from platform_download_stats where platform = 'android'), 0);
$$;

grant execute on function get_public_platform_stats() to anon, authenticated;
