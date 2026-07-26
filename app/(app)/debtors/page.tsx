import { getDebtorsOverview } from "@/lib/queries/debtors";
import { requireManagerProfile } from "@/lib/queries/session";
import { canManageCustomers } from "@/lib/entitlements";
import { DebtorsClient } from "@/components/debtors/DebtorsClient";
import { PremiumLockedState } from "@/components/billing/PremiumLockedState";

export default async function DebtorsPage() {
  const { profile } = await requireManagerProfile();
  if (!(await canManageCustomers())) return <PremiumLockedState feature="Customer management" />;

  const overview = await getDebtorsOverview();
  const canDelete = profile.role === "owner" || profile.role === "admin";

  return <DebtorsClient overview={overview} canDelete={canDelete} />;
}
