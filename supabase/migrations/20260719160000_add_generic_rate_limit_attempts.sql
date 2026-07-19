-- Generic rate-limit ledger for login, password-reset, and MFA-verify pre-
-- checks (mirrors signup_attempts/mfa_recovery_attempts' shape but keyed by
-- an arbitrary bucket so new call sites don't each need their own table).
-- Service-role only, same reasoning as those tables: must never be
-- readable/writable/tamperable from the browser being rate-limited.
create table rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_attempts_bucket_key_created_idx on rate_limit_attempts (bucket, key, created_at desc);
alter table rate_limit_attempts enable row level security;
