-- Platform-wide support widget config (Tawk.to + WhatsApp) — Inventra's own
-- support channels for its subscribers, not a per-organization setting, so
-- this is a singleton table with no org_id, read only via the service-role
-- client from the root layout (never through the anon-key client, so no
-- RLS policy is needed for the read path) and written only through a
-- Server Action gated by requirePlatformAdmin().
create table support_settings (
  id uuid primary key default gen_random_uuid(),
  tawk_property_id text,
  tawk_widget_id text,
  whatsapp_number text not null default '2348036305562',
  whatsapp_message text not null default 'Hello Inventra Support,

I need assistance with my Inventra account.

Please help me.

Thank you.',
  business_hours text not null default 'Monday - Saturday, 8:00 AM - 6:00 PM (WAT)',
  support_email text not null default 'royalmandigitalconcept@gmail.com',
  average_response text not null default 'Within 5 minutes',
  tawk_enabled boolean not null default false,
  whatsapp_enabled boolean not null default true,
  widget_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into support_settings (whatsapp_number, support_email) values ('2348036305562', 'royalmandigitalconcept@gmail.com');
