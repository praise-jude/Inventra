import { getExpensesOverview } from "@/lib/queries/expenses";
import { getWarehouseOptions } from "@/lib/queries/products";
import { requireManagerProfile } from "@/lib/queries/session";
import { ExpensesClient } from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage() {
  const { org } = await requireManagerProfile();
  const [overview, warehouses] = await Promise.all([getExpensesOverview(org.timezone), getWarehouseOptions()]);

  return <ExpensesClient overview={overview} warehouses={warehouses} />;
}
