-- In-app notification feed + mobile push token storage. Distinct from
-- notification_settings (org-level digest-email toggles, already existed)
-- and the Topbar's "stock alerts" bell (a live query, not persisted) —
-- this is a genuine per-user inbox, first used for team approval/rejection
-- events (see lib/notifications-service.ts).
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;

create policy notifications_select_own on notifications for select
  using (user_id = auth.uid());
create policy notifications_update_own on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Any org member can create a notification for another member of the same
-- org — deliberately not service-role-only, so it can be inserted directly
-- from whichever session already triggered the underlying event (a Server
-- Action's cookie session, a mobile RLS-scoped write, or even a not-yet-
-- approved member's own session notifying their org's admins that they're
-- awaiting approval).
create policy notifications_insert_org on notifications for insert
  with check (
    org_id = current_org_id()
    and exists (select 1 from profiles p where p.id = user_id and p.org_id = current_org_id())
  );

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on push_tokens (user_id);
alter table push_tokens enable row level security;

create policy push_tokens_select_own on push_tokens for select
  using (user_id = auth.uid());
create policy push_tokens_insert_own on push_tokens for insert
  with check (user_id = auth.uid());
-- token is unique — registerPushToken() upserts on conflict, since the
-- same device can be reused by a different team member after a
-- logout/login. Lets any authenticated session reassign an existing
-- token row to itself (not scoped to the row's current owner) so that
-- handoff works; owning a token only routes future pushes to that
-- session, nothing else, so this isn't a meaningful access grant.
create policy push_tokens_update_reassign on push_tokens for update
  using (true) with check (user_id = auth.uid());
create policy push_tokens_delete_own on push_tokens for delete
  using (user_id = auth.uid());

-- Nothing was in the supabase_realtime publication before this — every
-- postgres_changes subscription (the notifications feed here, and the
-- Team screens' live status sync) needs its table added explicitly, RLS
-- still applies per-connection so a subscriber only ever receives rows
-- their own session could already SELECT.
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table profiles;
