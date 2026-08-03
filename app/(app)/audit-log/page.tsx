import { requireAdminProfile } from "@/lib/queries/session";
import { getAuditLogs, getAuditModules, type AuditLogFilters } from "@/lib/queries/audit";
import { getDailySalesSummary } from "@/lib/queries/sales-summary";
import { getWarehouseOptions } from "@/lib/queries/products";
import { AuditLogClient } from "@/components/audit/AuditLogClient";
import { SalesSummaryPanel } from "@/components/audit/SalesSummaryPanel";
import { canViewAuditLog } from "@/lib/entitlements";
import { PremiumLockedState } from "@/components/billing/PremiumLockedState";

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { org } = await requireAdminProfile();

  if (!(await canViewAuditLog())) {
    return (
      <div className="animate-fade-up">
        <div className="mb-5">
          <div className="text-[22px] font-bold tracking-tight">Audit Log</div>
          <div className="mt-[3px] text-text-2">Every important action taken across your workspace, with a full before/after trail.</div>
        </div>
        <PremiumLockedState feature="The audit log" />
      </div>
    );
  }

  const params = await searchParams;

  const filters: AuditLogFilters = {
    search: params.q,
    module: params.module,
    dateFrom: params.from,
    dateTo: params.to,
    branchId: params.branch,
  };
  const page = Math.max(1, Number(params.page) || 1);

  // Resolved in the org's own timezone (not the server's) — same reasoning
  // as the Dashboard's own "today"/"this month" boundaries elsewhere in
  // this codebase, so a sale made late at night in the org's local time
  // isn't miscounted into the wrong day just because the server is on UTC.
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: org.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [yearStr, monthStr, dayStr] = todayKey.split("-");
  const daysElapsedInMonth = Number(dayStr);
  const monthStartKey = `${yearStr}-${monthStr}-01`;
  const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: org.timezone, month: "long", year: "numeric" }).format(now);

  const [{ rows, total }, modules, branches, monthlySalesRows] = await Promise.all([
    getAuditLogs(filters, page, PAGE_SIZE),
    getAuditModules(),
    getWarehouseOptions(),
    getDailySalesSummary(monthStartKey, todayKey),
  ]);

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Audit Log</div>
        <div className="mt-[3px] text-text-2">Every important action taken across your workspace, with a full before/after trail.</div>
      </div>
      <SalesSummaryPanel monthLabel={monthLabel} daysElapsedInMonth={daysElapsedInMonth} initialMonthRows={monthlySalesRows} />
      <AuditLogClient
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        modules={modules}
        branches={branches}
        filters={{ q: params.q ?? "", module: params.module ?? "", from: params.from ?? "", to: params.to ?? "", branch: params.branch ?? "" }}
      />
    </div>
  );
}
