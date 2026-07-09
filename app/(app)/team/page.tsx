import { getTeamMembers } from "@/lib/queries/team";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireAdminProfile } from "@/lib/queries/session";
import { TeamClient } from "@/components/team/TeamClient";

const PLAN_SEATS: Record<string, number> = { starter: 2, growth: 15, scale: 999 };

export default async function TeamPage() {
  const [members, warehouses, { org, profile }] = await Promise.all([
    getTeamMembers(),
    getWarehouseOptions(),
    requireAdminProfile(),
  ]);
  const seatsTotal = PLAN_SEATS[org.plan] ?? 5;

  return (
    <TeamClient
      members={members}
      seatsUsed={members.length}
      seatsTotal={seatsTotal}
      currentUserId={profile.id}
      warehouses={warehouses}
    />
  );
}
