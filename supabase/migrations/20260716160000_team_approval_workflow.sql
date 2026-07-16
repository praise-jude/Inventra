-- Team approval workflow: an invited member who finishes onboarding lands
-- in 'awaiting_approval' instead of jumping straight to 'active' (previous
-- behavior — see accept-invite/page.tsx before this migration). Rejection
-- is modeled the same way suspension already is (a nullable timestamp +
-- reason on profiles, not a status enum value) so status keeps tracking
-- only the invite/onboarding lifecycle, matching the existing
-- suspended_at pattern instead of introducing a second, inconsistent one.
alter type member_status add value 'awaiting_approval';

alter table profiles
  add column rejected_at timestamptz,
  add column rejected_reason text,
  add column approved_by uuid references auth.users (id) on delete set null,
  add column approved_at timestamptz;

-- Device/user-agent alongside the audit log's existing IP capture —
-- additive, nullable, every previous logAudit() call keeps working
-- unchanged.
alter table audit_logs add column device text;
