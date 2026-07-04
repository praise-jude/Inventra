import { getDebtorsOverview } from "@/lib/queries/debtors";
import { requireManagerProfile } from "@/lib/queries/session";
import { DebtorsClient } from "@/components/debtors/DebtorsClient";

export default async function DebtorsPage() {
  const [overview, { profile }] = await Promise.all([getDebtorsOverview(), requireManagerProfile()]);
  const canDelete = profile.role === "owner" || profile.role === "admin";

  return <DebtorsClient overview={overview} canDelete={canDelete} />;
}
