import { requireAdminProfile } from "@/lib/queries/session";
import { getAuditLogs, getAuditModules, type AuditLogFilters } from "@/lib/queries/audit";
import { getWarehouseOptions } from "@/lib/queries/products";
import { AuditLogClient } from "@/components/audit/AuditLogClient";

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminProfile();
  const params = await searchParams;

  const filters: AuditLogFilters = {
    search: params.q,
    module: params.module,
    dateFrom: params.from,
    dateTo: params.to,
    branchId: params.branch,
  };
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total }, modules, branches] = await Promise.all([
    getAuditLogs(filters, page, PAGE_SIZE),
    getAuditModules(),
    getWarehouseOptions(),
  ]);

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Audit Log</div>
        <div className="mt-[3px] text-text-2">Every important action taken across your workspace, with a full before/after trail.</div>
      </div>
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
