import { requirePlatformAdmin } from "@/lib/queries/session";
import { getSupportSettings } from "@/lib/queries/support-settings";
import { SupportSettingsClient } from "@/components/admin/SupportSettingsClient";

export default async function SupportSettingsPage() {
  await requirePlatformAdmin();
  const settings = await getSupportSettings();
  return <SupportSettingsClient settings={settings} />;
}
