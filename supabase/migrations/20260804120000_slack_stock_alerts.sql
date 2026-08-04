-- Real Slack integration for stock alerts (Settings -> Integrations' Slack
-- card was purely cosmetic — clicking "Connect" just flipped a status flag
-- with nowhere to store a webhook URL, and low_stock/out_of_stock/
-- expiring_products/weekly_digest in notification_settings were never
-- actually read anywhere — no alert-sending system existed at all yet).
--
-- config holds { "webhook_url": "https://hooks.slack.com/..." } for the
-- 'slack' provider row. Uses Slack's Incoming Webhooks (a per-workspace
-- POST URL the org admin creates and pastes in) rather than a full OAuth
-- App — no app review/approval needed, works today.
alter table integrations add column if not exists config jsonb;

-- Dedup: every stock_movements insert (sale, adjustment, transfer,
-- receiving — the same DB trigger, apply_stock_movement(), fires for all
-- of them on both web and mobile) would otherwise re-alert on every
-- subsequent sale of an already-low product. Tracks the status this
-- product was last alerted at; only alerts again on a genuine transition
-- (in_stock -> low_stock, low_stock -> out_of_stock, etc.), and clears
-- back to null once restocked so a future dip alerts again.
alter table products add column if not exists last_alerted_status text;
