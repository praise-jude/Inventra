import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { ApprovalSettingsForm } from "@/components/settings/ApprovalSettingsForm";

export default async function ApprovalSettingsPage() {
  const { org } = await requireAdminProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("approval_settings").select("*").eq("org_id", org.id).single();

  return (
    <ApprovalSettingsForm
      discountApprovalEnabled={data?.discount_approval_enabled ?? false}
      discountThresholdPct={data?.discount_threshold_pct ?? 20}
      voidApprovalEnabled={data?.void_approval_enabled ?? false}
      voidThresholdAmount={data?.void_threshold_amount ?? 10000}
      priceChangeApprovalEnabled={data?.price_change_approval_enabled ?? false}
      priceChangeThresholdPct={data?.price_change_threshold_pct ?? 20}
    />
  );
}
