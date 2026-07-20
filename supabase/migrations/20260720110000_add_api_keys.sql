-- Public API key management. Keys authenticate app/api/v1/* requests —
-- they are NOT Supabase Auth sessions (no auth.uid()), so RLS can't scope
-- them the normal way; API routes use the service-role client and filter
-- by org_id explicitly, same as the existing app/api/mobile/* bearer-token
-- routes already do for service-role-only operations.
--
-- Only the raw key is ever shown to the user, once, at creation time — the
-- table stores a SHA-256 hash (key_hash) for lookup, plus a short
-- non-secret prefix (key_prefix) so the UI can show "inv_live_ab12…"
-- without ever re-displaying the full secret.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_keys_org_id_idx on api_keys (org_id);
create index api_keys_key_hash_idx on api_keys (key_hash) where revoked_at is null;
alter table api_keys enable row level security;

-- Admins can see/manage their own org's keys (the raw key itself is never
-- stored, so this is safe to expose — key_hash included is fine too,
-- since it's a one-way hash, not the secret).
create policy api_keys_select_admin on api_keys for select
  using (org_id = current_org_id() and is_org_admin());
create policy api_keys_write_admin on api_keys for all
  using (org_id = current_org_id() and is_org_admin())
  with check (org_id = current_org_id() and is_org_admin());

-- Per-key request log — doubles as the rate-limiting ledger (count rows in
-- the last N seconds) and a usage/audit trail ("show sync history" from
-- the original ask). Service-role only, same reasoning as
-- rate_limit_attempts: must never be readable/writable from a client
-- holding just the API key itself.
create table api_key_requests (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references api_keys (id) on delete cascade,
  method text not null,
  path text not null,
  status_code int,
  created_at timestamptz not null default now()
);
create index api_key_requests_key_created_idx on api_key_requests (api_key_id, created_at desc);
alter table api_key_requests enable row level security;
create policy api_key_requests_select_admin on api_key_requests for select
  using (api_key_id in (select id from api_keys where org_id = current_org_id() and is_org_admin()));
