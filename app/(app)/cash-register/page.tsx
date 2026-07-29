import { requireProfile } from "@/lib/queries/session";
import { getWarehouseOptions } from "@/lib/queries/products";
import { getTodaysCashRegister, getCashRegisterHistory } from "@/lib/queries/cash-register";
import { CashRegisterClient } from "@/components/cash-register/CashRegisterClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAdminRole, isManagerRole } from "@/lib/roles";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Open to every org member (Staff view "today's cash only" per spec) —
// CashRegisterClient itself narrows what's rendered/actionable by role,
// same pattern as the Dashboard's showAnalytics gate rather than a hard
// page-level redirect.
export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;

  const branches = await getWarehouseOptions();
  if (branches.length === 0) {
    return (
      <div className="animate-fade-up">
        <div className="mb-5">
          <div className="text-[22px] font-bold tracking-tight">Cash Register</div>
        </div>
        <EmptyState
          icon="🏬"
          title="No branches yet"
          description="Add a branch under Settings → Branches before opening a cash register."
        />
      </div>
    );
  }

  const branchId = branches.some((b) => b.id === params.branch) ? params.branch! : branches[0].id;
  const isManager = isManagerRole(profile.role);
  const isAdmin = isAdminRole(profile.role);

  const since = new Date();
  since.setDate(since.getDate() - 180);

  const [today, history] = await Promise.all([
    getTodaysCashRegister(branchId),
    isManager ? getCashRegisterHistory(branchId, isoDate(since), isoDate(new Date())) : Promise.resolve([]),
  ]);

  return (
    <CashRegisterClient
      branches={branches}
      branchId={branchId}
      today={today}
      history={history}
      isManager={isManager}
      isAdmin={isAdmin}
    />
  );
}
