import { getWarehousesOverview } from "@/lib/queries/inventory";
import { getTeamMembers } from "@/lib/queries/team";
import { requireProfile } from "@/lib/queries/session";
import { isAdminRole, isManagerRole } from "@/lib/roles";
import { WarehousesClient } from "@/components/inventory/WarehousesClient";

export default async function WarehousesPage() {
  const [warehouses, teamMembers, { profile, org }] = await Promise.all([
    getWarehousesOverview(),
    getTeamMembers(),
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
      currency={org.currency}
      canManage={canManage}
      canDelete={canDelete}
      canTransfer={canTransfer}
    />
  );
}
