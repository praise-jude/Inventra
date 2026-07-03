import { cookies } from "next/headers";
import { requireProfile } from "@/lib/queries/session";
import { getKpis } from "@/lib/queries/dashboard";
import { ToastProvider } from "@/components/app/ToastProvider";
import { Shell } from "@/components/app/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, org } = await requireProfile();
  const kpis = await getKpis();
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
  const inventoryBadge = kpis.low_stock_count + kpis.out_of_stock_count;

  return (
    <ToastProvider>
      <Shell
        orgName={org.name}
        plan={org.plan}
        inventoryBadge={inventoryBadge}
        initials={initials}
        firstName={profile.first_name}
        initialTheme={initialTheme}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
