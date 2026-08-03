import { cookies } from "next/headers";
import { requireProfile } from "@/lib/queries/session";
import { getStockBadgeCounts } from "@/lib/queries/dashboard";
import { getPendingApprovalsCount } from "@/lib/queries/team";
import { getEntitlements } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/app/ToastProvider";
import { WorkspaceProvider } from "@/components/app/CurrencyProvider";
import { PresenceProvider } from "@/components/app/PresenceProvider";
import { EntitlementsProvider } from "@/components/billing/EntitlementsProvider";
import { Shell } from "@/components/app/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, org } = await requireProfile();
  const supabase = await createClient();
  const [stockBadge, entitlements, teamBadge, canViewSupplyRecords] = await Promise.all([
    getStockBadgeCounts(),
    getEntitlements(),
    getPendingApprovalsCount(profile.role, profile.branch_id),
    supabase.rpc("has_permission", { p_module: "supply_records", p_action: "view" }).then((r) => r.data === true),
  ]);
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
  const inventoryBadge = stockBadge.lowStockCount + stockBadge.outOfStockCount;

  return (
    <WorkspaceProvider currency={org.currency} timezone={org.timezone}>
      <EntitlementsProvider entitlements={entitlements}>
        <ToastProvider>
          <PresenceProvider
            userId={profile.id}
            orgId={profile.org_id}
            name={`${profile.first_name} ${profile.last_name}`}
            role={profile.role}
          >
            <Shell
              orgName={org.name}
              plan={org.plan}
              tier={entitlements.tier}
              inventoryBadge={inventoryBadge}
              teamBadge={teamBadge}
              canViewSupplyRecords={canViewSupplyRecords}
              initials={initials}
              firstName={profile.first_name}
              initialTheme={initialTheme}
              role={profile.role}
            >
              {children}
            </Shell>
          </PresenceProvider>
        </ToastProvider>
      </EntitlementsProvider>
    </WorkspaceProvider>
  );
}
