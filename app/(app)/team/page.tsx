import { getTeamMembers } from "@/lib/queries/team";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireManagerProfile } from "@/lib/queries/session";
import { ADMIN_ROLES } from "@/lib/roles";
import { TeamClient } from "@/components/team/TeamClient";

const PLAN_SEATS: Record<string, number> = { starter: 2, growth: 15, scale: 999 };

// Managers can reach this page too now (invite Staff, approve/reject) —
// TeamClient hides role-change/suspend/remove and restricts the invite
// role picker for them based on isAdmin below; requireManagerProfile still
// blocks Cashier/Warehouse entirely.
export default async function TeamPage() {
  const [members, warehouses, { org, profile }] = await Promise.all([
    getTeamMembers(),
    getWarehouseOptions(),
    requireManagerProfile(),
  ]);
  const seatsTotal = PLAN_SEATS[org.plan] ?? 5;

  return (
    <TeamClient
      members={members}
      seatsUsed={members.length}
      seatsTotal={seatsTotal}
      currentUserId={profile.id}
      orgId={profile.org_id}
      warehouses={warehouses}
      isAdmin={ADMIN_ROLES.includes(profile.role)}
    />
  );
}
