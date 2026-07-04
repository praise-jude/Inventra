import { requireProfile } from "@/lib/queries/session";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";

export default async function GeneralSettingsPage() {
  const { profile, org } = await requireProfile();

  return (
    <GeneralSettingsForm
      name={org.name}
      supportEmail={org.support_email ?? ""}
      currency={org.currency}
      country={org.country ?? ""}
      state={org.state ?? ""}
      timezone={org.timezone}
      taxRate={Number(org.tax_rate)}
      themePreference={profile.theme_preference}
    />
  );
}
