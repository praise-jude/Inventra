import { cookies } from "next/headers";
import { requireProfile } from "@/lib/queries/session";
import { getKpis } from "@/lib/queries/dashboard";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/app/ToastProvider";
import { WorkspaceProvider } from "@/components/app/CurrencyProvider";
import { PresenceProvider } from "@/components/app/PresenceProvider";
import { Shell } from "@/components/app/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, org } = await requireProfile();
  const kpis = await getKpis();
  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("org_id", profile.org_id)
    .single();
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
  const inventoryBadge = kpis.low_stock_count + kpis.out_of_stock_count;

  return (
    <WorkspaceProvider currency={org.currency} timezone={org.timezone}>
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
            trialStatus={subscription?.status ?? null}
            trialEndsAt={subscription?.trial_ends_at ?? null}
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
    </WorkspaceProvider>
  );
}
