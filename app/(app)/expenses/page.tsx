import { getExpensesOverview } from "@/lib/queries/expenses";
import { requireManagerProfile } from "@/lib/queries/session";
import { ExpensesClient } from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage() {
  const { org } = await requireManagerProfile();
  const overview = await getExpensesOverview(org.timezone);

  return <ExpensesClient overview={overview} />;
}
