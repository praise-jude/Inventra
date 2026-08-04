"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { Table, type TableColumn } from "@/components/ui/Table";
import { ExportMenu } from "@/components/ui/ExportMenu";
import type { BranchPerformanceRow } from "@/lib/queries/reports";

export function BranchPerformanceClient({ rows }: { rows: BranchPerformanceRow[] }) {
  const { format } = useWorkspace();

  const { topBranch, lowestBranch } = useMemo(() => {
    if (rows.length === 0) return { topBranch: null, lowestBranch: null };
    const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
    return { topBranch: sorted[0], lowestBranch: sorted[sorted.length - 1] };
  }, [rows]);

  const columns: TableColumn<BranchPerformanceRow>[] = [
    { key: "branch", header: "Branch", sortable: true, sortValue: (r) => r.branchName, render: (r) => r.branchName },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (r) => r.revenue, render: (r) => format(r.revenue) },
    { key: "profit", header: "Profit", align: "right", sortable: true, sortValue: (r) => r.profit, render: (r) => format(r.profit) },
    { key: "expenses", header: "Expenses", align: "right", sortable: true, sortValue: (r) => r.expenses, render: (r) => format(r.expenses) },
    { key: "stockValue", header: "Stock value", align: "right", sortable: true, sortValue: (r) => r.stockValue, render: (r) => format(r.stockValue) },
    { key: "skuCount", header: "SKUs", align: "right", sortable: true, sortValue: (r) => r.skuCount, render: (r) => r.skuCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      {rows.length > 1 && topBranch && lowestBranch && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-sm)]">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Top selling branch</div>
            <div className="mt-1 text-[16px] font-bold text-text">{topBranch.branchName}</div>
            <div className="text-[13px] font-semibold text-accent-text">{format(topBranch.revenue)} revenue</div>
          </div>
          <div className="rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-sm)]">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Lowest performing branch</div>
            <div className="mt-1 text-[16px] font-bold text-text">{lowestBranch.branchName}</div>
            <div className="text-[13px] font-semibold text-red">{format(lowestBranch.revenue)} revenue</div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[14.5px] font-bold">Branch performance</h3>
          <ExportMenu
            rows={rows}
            columns={[
              { key: "branch", header: "Branch", value: (r: BranchPerformanceRow) => r.branchName },
              { key: "revenue", header: "Revenue", value: (r: BranchPerformanceRow) => r.revenue },
              { key: "profit", header: "Profit", value: (r: BranchPerformanceRow) => r.profit },
              { key: "expenses", header: "Expenses", value: (r: BranchPerformanceRow) => r.expenses },
              { key: "stockValue", header: "Stock value", value: (r: BranchPerformanceRow) => r.stockValue },
              { key: "skuCount", header: "SKUs", value: (r: BranchPerformanceRow) => r.skuCount },
            ]}
            filenameBase="branch-performance"
            pdfTitle="Reports — Branch Performance"
          />
        </div>
        <Table columns={columns} rows={rows} rowKey={(r) => r.warehouseId} pageSize={10} emptyState="No branches yet." />
      </div>
    </div>
  );
}
