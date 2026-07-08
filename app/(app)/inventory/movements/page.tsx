import { getStockMovements } from "@/lib/queries/inventory";
import { requireProfile } from "@/lib/queries/session";
import { MovementsTable } from "@/components/inventory/MovementsTable";

export default async function MovementsPage() {
  const [movements, { org }] = await Promise.all([getStockMovements(50), requireProfile()]);

  return <MovementsTable movements={movements} timezone={org.timezone} />;
}
