-- See note in 20260711191212_create_fraudshield_tables.sql — recreated
-- verbatim purely to reconcile migration history; removed in full by the
-- migration that follows this one.
drop policy if exists "fraudshield_transactions_public_all" on public.fraudshield_transactions;
drop policy if exists "fraudshield_cases_public_all" on public.fraudshield_cases;
drop policy if exists "fraudshield_rules_public_all" on public.fraudshield_rules;

alter table public.fraudshield_transactions
  add constraint fraudshield_transactions_risk_score_range check (risk_score >= 0 and risk_score <= 100);
alter table public.fraudshield_cases
  add constraint fraudshield_cases_status_valid check (status in ('new', 'investigating', 'resolved'));

create policy "fraudshield_transactions_select" on public.fraudshield_transactions
  for select to anon using (true);
create policy "fraudshield_transactions_insert" on public.fraudshield_transactions
  for insert to anon with check (true);

create policy "fraudshield_cases_select" on public.fraudshield_cases
  for select to anon using (true);
create policy "fraudshield_cases_insert" on public.fraudshield_cases
  for insert to anon with check (true);
create policy "fraudshield_cases_update_status" on public.fraudshield_cases
  for update to anon using (true) with check (true);
revoke update on public.fraudshield_cases from anon;
grant update (status) on public.fraudshield_cases to anon;

create policy "fraudshield_rules_select" on public.fraudshield_rules
  for select to anon using (true);
create policy "fraudshield_rules_update_enabled" on public.fraudshield_rules
  for update to anon using (true) with check (true);
revoke update on public.fraudshield_rules from anon;
grant update (enabled) on public.fraudshield_rules to anon;

create table if not exists public.fraudshield_report_exports (
  id bigint generated always as identity primary key,
  report_id text not null,
  report_name text not null,
  exported_at timestamptz not null default now()
);
alter table public.fraudshield_report_exports enable row level security;
create policy "fraudshield_report_exports_select" on public.fraudshield_report_exports
  for select to anon using (true);
create policy "fraudshield_report_exports_insert" on public.fraudshield_report_exports
  for insert to anon with check (true);
