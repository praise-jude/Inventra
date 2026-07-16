-- Backup/recovery codes for TOTP MFA — Supabase Auth's native MFA
-- (auth.mfa_factors) handles the actual TOTP secret/verification/AAL, but
-- has no built-in concept of single-use backup codes for "lost my
-- authenticator" recovery, so that layer lives in our own schema.
create table mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index mfa_recovery_codes_user_id_idx on mfa_recovery_codes (user_id);

alter table mfa_recovery_codes enable row level security;

-- Read-only for the owning user (Security settings page shows "N codes
-- remaining"); all writes (generation, consumption, cleanup) go through
-- Server Actions using the service-role admin client, since consuming a
-- code requires comparing against a hash — not something a client-writable
-- RLS policy can safely express.
create policy mfa_recovery_codes_select_own on mfa_recovery_codes
  for select using (user_id = auth.uid());

-- Per-user rate limiting for recovery-code verification attempts, mirroring
-- signup_attempts' shape/intent (lib/actions/auth.ts) but keyed by user_id
-- instead of IP since this only happens post-password-login.
create table mfa_recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index mfa_recovery_attempts_user_id_idx on mfa_recovery_attempts (user_id);

alter table mfa_recovery_attempts enable row level security;
-- No policies for anon/authenticated — service-role only, same reasoning
-- as signup_attempts (must never be readable/writable/tamperable by the
-- client being rate-limited).
