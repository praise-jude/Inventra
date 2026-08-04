import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { IntegrationsClient } from "@/components/settings/IntegrationsClient";
import { canManageIntegrations } from "@/lib/entitlements";
import { PremiumLockedState } from "@/components/billing/PremiumLockedState";
import { getGoogleCloudStatus } from "@/lib/google-cloud/storage";

export default async function IntegrationsSettingsPage() {
  const { org } = await requireAdminProfile();
  if (!(await canManageIntegrations())) return <PremiumLockedState feature="Integrations" />;
  const supabase = await createClient();
  const [{ data }, { data: subscription }, cloudStatus] = await Promise.all([
    supabase.from("integrations").select("provider, status").eq("org_id", org.id),
    supabase.from("subscriptions").select("authorization_code").eq("org_id", org.id).single(),
    getGoogleCloudStatus(),
  ]);

  // Paystack is no longer a cosmetic toggle — its connection state reflects
  // whether a real tokenized card is on file (managed from Billing).
  const rows = (data ?? []).map((row) =>
    row.provider === "paystack" ? { ...row, status: subscription?.authorization_code ? "connected" : "not_connected" } : row,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Unlike the toggles below (cosmetic flags in the `integrations`
          table, flipped by the user — see toggleIntegration), this is a
          live-checked read of the actual backend: whether Google Cloud
          Storage's env vars are set AND the bucket is reachable right now.
          Powers invoice PDF archival (lib/actions/invoices.ts). */}
      <div className="flex items-center gap-3 rounded-[13px] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <span
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[18px]"
          style={{ background: cloudStatus.connected ? "var(--green-weak)" : "var(--red-weak)" }}
        >
          ☁️
        </span>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold">Google Cloud Storage</div>
          <div className="mt-0.5 text-[12px] leading-snug text-text-2">Invoice PDF archival</div>
        </div>
        <span
          className="rounded-[20px] px-[9px] py-0.5 text-[11px] font-bold"
          style={
            cloudStatus.connected
              ? { color: "var(--green)", background: "var(--green-weak)" }
              : { color: "var(--red)", background: "var(--red-weak)" }
          }
        >
          {cloudStatus.connected ? "Connected" : cloudStatus.configured ? "Unreachable" : "Not configured"}
        </span>
      </div>

      <IntegrationsClient initial={rows} />
    </div>
  );
}
