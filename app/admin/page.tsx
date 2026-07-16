import { requirePlatformAdmin } from "@/lib/queries/session";
import { getPlatformStats, searchOrgSubscriptions } from "@/lib/queries/platform-admin";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;

  const [stats, rows] = await Promise.all([getPlatformStats(), searchOrgSubscriptions(q ?? "")]);

  return <AdminDashboardClient stats={stats} rows={rows} query={q ?? ""} />;
}
