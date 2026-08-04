import { getWarehousesOverview } from "@/lib/queries/inventory";
import { getActiveTeamMembersForPresence } from "@/lib/queries/team";
import { listBranchStaff } from "@/lib/queries/branch-staff";
import { requireProfile } from "@/lib/queries/session";
import { isAdminRole, isManagerRole } from "@/lib/roles";
import { WarehousesClient } from "@/components/inventory/WarehousesClient";

export default async function WarehousesPage() {
  const [warehouses, teamMembers, staff, { profile, org }] = await Promise.all([
    getWarehousesOverview(),
    getActiveTeamMembersForPresence(),
    listBranchStaff(),
    requireProfile(),
  ]);
  const canManage = isAdminRole(profile.role);
  const canDelete = isAdminRole(profile.role);
  const canTransfer = isManagerRole(profile.role);
  const managers = teamMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <WarehousesClient
      warehouses={warehouses}
      managers={managers}
      staff={staff}
      currency={org.currency}
      canManage={canManage}
      canDelete={canDelete}
      canTransfer={canTransfer}
    />
  );
}
