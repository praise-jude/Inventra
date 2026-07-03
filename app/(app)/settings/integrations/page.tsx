import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/queries/session";
import { IntegrationsClient } from "@/components/settings/IntegrationsClient";

export default async function IntegrationsSettingsPage() {
  const { org } = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("provider, status").eq("org_id", org.id);

  return <IntegrationsClient initial={data ?? []} />;
}
