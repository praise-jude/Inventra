import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { IntegrationsClient } from "@/components/settings/IntegrationsClient";

export default async function IntegrationsSettingsPage() {
  const { org } = await requireAdminProfile();
  const supabase = await createClient();
  const [{ data }, { data: subscription }] = await Promise.all([
    supabase.from("integrations").select("provider, status").eq("org_id", org.id),
    supabase.from("subscriptions").select("authorization_code").eq("org_id", org.id).single(),
  ]);

  // Paystack is no longer a cosmetic toggle — its connection state reflects
  // whether a real tokenized card is on file (managed from Billing).
  const rows = (data ?? []).map((row) =>
    row.provider === "paystack" ? { ...row, status: subscription?.authorization_code ? "connected" : "not_connected" } : row,
  );

  return <IntegrationsClient initial={rows} />;
}
