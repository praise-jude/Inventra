import { getWarehousesOverview } from "@/lib/queries/inventory";
import { getActiveTeamMembersForPresence } from "@/lib/queries/team";
import { requireAdminProfile } from "@/lib/queries/session";
import { WarehousesClient } from "@/components/inventory/WarehousesClient";

export default async function BranchesSettingsPage() {
  const [warehouses, teamMembers, { org }] = await Promise.all([
    getWarehousesOverview(),
    getActiveTeamMembersForPresence(),
    requireAdminProfile(),
  ]);
  const managers = teamMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <WarehousesClient
      warehouses={warehouses}
      managers={managers}
      currency={org.currency}
      canManage
      canDelete
      canTransfer
    />
  );
}
