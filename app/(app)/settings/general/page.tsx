import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";
import { ReferralCard } from "@/components/settings/ReferralCard";

export default async function GeneralSettingsPage() {
  const { profile, org } = await requireAdminProfile();

  const supabase = await createClient();
  const { data: referredOrgs } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .eq("referred_by_org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4.5">
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
      <ReferralCard code={org.referral_code} referredOrgs={referredOrgs ?? []} />
    </div>
  );
}
