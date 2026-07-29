import { getDebtorsOverview } from "@/lib/queries/debtors";
import { requireManagerProfile } from "@/lib/queries/session";
import { canManageCustomers } from "@/lib/entitlements";
import { DebtorsClient } from "@/components/debtors/DebtorsClient";
import { PremiumLockedState } from "@/components/billing/PremiumLockedState";
import type { DebtorStatus } from "@/lib/supabase/database.types";

const PAGE_SIZE = 20;

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile } = await requireManagerProfile();
  if (!(await canManageCustomers())) return <PremiumLockedState feature="Customer management" />;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const overview = await getDebtorsOverview(
    { search: params.q, status: params.status as DebtorStatus | undefined },
    page,
    PAGE_SIZE,
  );
  const canDelete = profile.role === "owner" || profile.role === "admin";

  return (
    <DebtorsClient
      overview={overview}
      page={page}
      pageSize={PAGE_SIZE}
      canDelete={canDelete}
      filters={{ q: params.q ?? "", status: params.status ?? "" }}
    />
  );
}
