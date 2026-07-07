import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { IntegrationsClient } from "@/components/settings/IntegrationsClient";

export default async function IntegrationsSettingsPage() {
  const { org } = await requireAdminProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("provider, status").eq("org_id", org.id);

  return <IntegrationsClient initial={data ?? []} />;
}
