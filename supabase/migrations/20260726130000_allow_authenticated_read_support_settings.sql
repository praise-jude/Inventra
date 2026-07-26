-- support_settings had RLS enabled with zero policies -- only readable via
-- the service-role admin client (web's root layout, lib/queries/support-
-- settings.ts). Mobile has no secure way to use a service-role key from
-- the app bundle, so for the mobile Support screen/widget to read this
-- platform-wide, non-sensitive singleton config (WhatsApp number/message,
-- business hours, support email) with its regular anon-key client, add a
-- plain authenticated-read policy. No write access granted.
create policy support_settings_select_authenticated on support_settings
  for select
  to authenticated
  using (true);
