import { cookies } from "next/headers";
import { requireProfile } from "@/lib/queries/session";
import { getKpis } from "@/lib/queries/dashboard";
import { getEntitlements } from "@/lib/entitlements";
import { ToastProvider } from "@/components/app/ToastProvider";
import { WorkspaceProvider } from "@/components/app/CurrencyProvider";
import { PresenceProvider } from "@/components/app/PresenceProvider";
import { EntitlementsProvider } from "@/components/billing/EntitlementsProvider";
import { Shell } from "@/components/app/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, org } = await requireProfile();
  const [kpis, entitlements] = await Promise.all([getKpis(), getEntitlements()]);
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
  const inventoryBadge = kpis.low_stock_count + kpis.out_of_stock_count;

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
