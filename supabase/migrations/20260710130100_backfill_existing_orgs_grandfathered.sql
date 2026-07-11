-- The real orgs that predate the card-required trial model are grandfathered
-- onto an active, unmetered subscription with no card and no billing — only
-- NEW signups go through the trial+card flow from here on. Idempotent (safe
-- to re-run) so a re-applied db push can't double-insert or double-flag.
insert into subscriptions (org_id, status, plan_key, currency, grandfathered, current_period_start, current_period_end)
select id, 'active', 'legacy', 'NGN', true, now(), now() + interval '100 years'
from organizations
where id not in (select org_id from subscriptions);

update organizations
   set plan = 'legacy'
 where id in (select org_id from subscriptions where grandfathered);
