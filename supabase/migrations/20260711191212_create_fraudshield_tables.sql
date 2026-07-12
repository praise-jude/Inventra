-- NOTE: this migration was applied directly to this project's remote database
-- by a different, unrelated project ("FraudShield AI") whose Supabase CLI was
-- mistakenly linked here instead of its own project. Recreated verbatim as a
-- local file purely to reconcile migration history with what's actually on
-- the remote database — see the following migration that removes all of it.
create table if not exists public.fraudshield_transactions (
  id text primary key,
  customer text not null,
  country text not null,
  device text not null,
  device_icon text not null,
  ip text not null,
  currency_symbol text not null,
  amount numeric not null,
  amount_display text not null,
  risk_score int not null,
  status_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fraudshield_cases (
  id bigint generated always as identity primary key,
  tx_id text not null references public.fraudshield_transactions(id) on delete cascade,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.fraudshield_rules (
  id text primary key,
  name text not null,
  description text not null,
  enabled boolean not null default true
);

alter table public.fraudshield_transactions enable row level security;
alter table public.fraudshield_cases enable row level security;
alter table public.fraudshield_rules enable row level security;

create policy "fraudshield_transactions_public_all" on public.fraudshield_transactions
  for all using (true) with check (true);
create policy "fraudshield_cases_public_all" on public.fraudshield_cases
  for all using (true) with check (true);
create policy "fraudshield_rules_public_all" on public.fraudshield_rules
  for all using (true) with check (true);

insert into public.fraudshield_rules (id, name, description, enabled) values
  ('r1', 'Block transactions above ₦500,000', 'Requires manual approval for any single transaction exceeding this threshold.', true),
  ('r2', 'Blacklisted country check', 'Automatically flags transactions originating from high-risk jurisdictions.', true),
  ('r3', 'New device verification', 'Require additional 2FA when a transaction comes from an unrecognized device.', true),
  ('r4', 'Outside business hours flag', 'Flags large transactions initiated between 12am–6am local time.', true),
  ('r5', 'Velocity check', 'Flags accounts with more than 20 transactions within a 2-minute window.', true),
  ('r6', 'Impossible travel detection', 'Flags logins from two distant locations within an implausible time window.', true)
on conflict (id) do nothing;
