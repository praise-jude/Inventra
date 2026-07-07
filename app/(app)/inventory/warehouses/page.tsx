import { getWarehousesOverview } from "@/lib/queries/inventory";
import { getTeamMembers } from "@/lib/queries/team";
import { requireProfile } from "@/lib/queries/session";
import { WarehousesClient } from "@/components/inventory/WarehousesClient";

export default async function WarehousesPage() {
  const [warehouses, teamMembers, { profile, org }] = await Promise.all([
    getWarehousesOverview(),
    getTeamMembers(),
    requireProfile(),
  ]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);
  const canDelete = ["owner", "admin"].includes(profile.role);
  const managers = teamMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <WarehousesClient
      warehouses={warehouses}
      managers={managers}
      currency={org.currency}
      canManage={canManage}
      canDelete={canDelete}
    />
  );
}
