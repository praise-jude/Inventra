-- Dedup flag for the pre-renewal reminder email (cron billing-sweep) —
-- reset to false whenever a charge succeeds (recordSuccessfulCharge) so it
-- fires once per billing cycle, mirroring trial_reminders_sent's role for
-- trial-ending reminders.
alter table subscriptions
  add column renewal_reminder_sent boolean not null default false;
