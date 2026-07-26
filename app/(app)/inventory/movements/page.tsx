import { getStockMovements } from "@/lib/queries/inventory";
import { requireProfile } from "@/lib/queries/session";
import { canViewStockMovements } from "@/lib/entitlements";
import { MovementsTable } from "@/components/inventory/MovementsTable";
import { PremiumLockedState } from "@/components/billing/PremiumLockedState";

export default async function MovementsPage() {
  const { org } = await requireProfile();
  if (!(await canViewStockMovements())) return <PremiumLockedState feature="Stock movement history" />;

  const movements = await getStockMovements(50);
  return <MovementsTable movements={movements} timezone={org.timezone} />;
}
