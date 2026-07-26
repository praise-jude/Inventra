-- Phase F8 — realtime sync so a successful upgrade unlocks Premium on
-- every logged-in device immediately, not just the one that paid.
alter publication supabase_realtime add table subscriptions;
