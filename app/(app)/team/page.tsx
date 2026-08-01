import { getTeamMembersPage, getTeamSummary, type TeamMembersFilters } from "@/lib/queries/team";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireManagerProfile } from "@/lib/queries/session";
import { ADMIN_ROLES } from "@/lib/roles";
import { TeamClient } from "@/components/team/TeamClient";

const PLAN_SEATS: Record<string, number> = { starter: 2, growth: 15, scale: 999 };
const PAGE_SIZE = 20;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters: TeamMembersFilters = {
    search: params.q || undefined,
    status: (params.status as TeamMembersFilters["status"]) || "all",
  };

  const [{ rows, total }, summary, warehouses, { org, profile }] = await Promise.all([
    getTeamMembersPage(filters, page, PAGE_SIZE),
    getTeamSummary(),
    getWarehouseOptions(),
    requireManagerProfile(),
  ]);
  const seatsTotal = PLAN_SEATS[org.plan] ?? 5;

  return (
    <TeamClient
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      summary={summary}
      seatsUsed={summary.total}
      seatsTotal={seatsTotal}
      currentUserId={profile.id}
      orgId={profile.org_id}
      warehouses={warehouses}
      isAdmin={ADMIN_ROLES.includes(profile.role)}
      filters={{ q: params.q ?? "", status: params.status ?? "" }}
    />
  );
}
