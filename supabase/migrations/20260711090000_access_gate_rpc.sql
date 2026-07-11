-- ============================================================================
-- Perf: middleware.ts ran 3 sequential round trips on every single
-- authenticated navigation (profiles -> organizations -> subscriptions) to
-- decide onboarding/subscription gating. Collapses that into one query via
-- left joins, same style as get_sales_summary() (language sql stable,
-- RLS-respecting — no security definer needed since profiles_select already
-- allows a user to read their own row via `id = auth.uid()`, and
-- current_org_id() resolves the rest).
-- ============================================================================

create function get_access_gate_state() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'profile_exists', p.id is not null,
    'terms_accepted', coalesce(p.terms_accepted, false),
    'org_id', p.org_id,
    'country', o.country,
    'subscription_status', s.status,
    'trial_ends_at', s.trial_ends_at,
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false)
  )
  from (select auth.uid() as uid) u
  left join profiles p on p.id = u.uid
  left join organizations o on o.id = p.org_id
  left join subscriptions s on s.org_id = p.org_id
$$;
