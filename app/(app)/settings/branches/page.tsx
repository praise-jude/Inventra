import { getWarehousesOverview } from "@/lib/queries/inventory";
import { getActiveTeamMembersForPresence } from "@/lib/queries/team";
import { listBranchStaff } from "@/lib/queries/branch-staff";
import { requireAdminProfile } from "@/lib/queries/session";
import { WarehousesClient } from "@/components/inventory/WarehousesClient";

export default async function BranchesSettingsPage() {
  const [warehouses, teamMembers, staff, { org }] = await Promise.all([
    getWarehousesOverview(),
    getActiveTeamMembersForPresence(),
    listBranchStaff(),
    requireAdminProfile(),
  ]);
  const managers = teamMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <WarehousesClient
      warehouses={warehouses}
      managers={managers}
      staff={staff}
      currency={org.currency}
      canManage
      canDelete
      canTransfer
    />
  );
}
