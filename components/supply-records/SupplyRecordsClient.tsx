"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export";
import { AreaChart } from "@/components/charts/AreaChart";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SupplyRecordRow, SupplySummary, SupplyCostTrendPoint } from "@/lib/queries/supply-records";

const STATUS_STYLE: Record<string, { color: string; background: string; label: string }> = {
  pending: { color: "var(--amber)", background: "var(--amber-weak)", label: "Pending" },
  received: { color: "var(--sky)", background: "var(--sky-weak)", label: "Received" },
  verified: { color: "var(--green)", background: "var(--green-weak)", label: "Verified" },
  cancelled: { color: "var(--red)", background: "var(--red-weak)", label: "Cancelled" },
};

interface FiltersState {
  q: string;
  status: string;
  warehouse: string;
}

export function SupplyRecordsClient({
  rows,
  total,
  page,
  pageSize,
  summary,
  costTrend,
  warehouses,
  isManager,
  filters,
}: {
  rows: SupplyRecordRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: SupplySummary;
  costTrend: SupplyCostTrendPoint[];
  warehouses: { id: string; name: string }[];
  isManager: boolean;
  filters: FiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Partial<FiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status) params.set("status", merged.status);
    if (merged.warehouse) params.set("warehouse", merged.warehouse);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search === filters.q) return;
    debounceRef.current = setTimeout(() => pushParams({ q: search }), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const exportColumns: ExportColumn<SupplyRecordRow>[] = [
    { key: "referenceNumber", header: "Reference", value: (r) => r.referenceNumber },
    { key: "supplierName", header: "Supplier", value: (r) => r.supplierName },
    { key: "invoiceNumber", header: "Invoice #", value: (r) => r.invoiceNumber ?? "" },
    { key: "warehouseName", header: "Branch", value: (r) => r.warehouseName ?? "" },
    { key: "dateSupplied", header: "Date", value: (r) => r.dateSupplied },
    { key: "status", header: "Status", value: (r) => STATUS_STYLE[r.status]?.label ?? r.status },
    { key: "totalQuantity", header: "Quantity", value: (r) => r.totalQuantity },
    { key: "totalAmount", header: "Amount", value: (r) => r.totalAmount },
    { key: "createdByName", header: "Recorded by", value: (r) => r.createdByName ?? "" },
  ];

  const cards = [
    { label: "Total Supplies", value: String(summary.totalSupplies), icon: "📦", bg: "var(--accent-weak)" },
    { label: "Total Supply Amount", value: formatMoney(summary.totalAmount), icon: "💰", bg: "var(--green-weak)" },
    { label: "Today's Supplies", value: String(summary.todaysSupplies), icon: "📅", bg: "var(--sky-weak)" },
    { label: "This Week", value: String(summary.thisWeekSupplies), icon: "🗓️", bg: "var(--sky-weak)" },
    { label: "This Month", value: String(summary.thisMonthSupplies), icon: "🗓️", bg: "var(--sky-weak)" },
    { label: "Total Quantity Received", value: String(summary.totalQuantityReceived), icon: "🔢", bg: "var(--accent-weak)" },
    { label: "Top Supplier", value: summary.topSupplier?.name ?? "—", icon: "🏆", bg: "var(--amber-weak)" },
    { label: "Most Supplied Product", value: summary.mostSuppliedProduct?.name ?? "—", icon: "⭐", bg: "var(--amber-weak)" },
  ];

  const columns: TableColumn<SupplyRecordRow>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (r) => (
        <div>
          <div className="text-[13.5px] font-semibold">{r.referenceNumber}</div>
          <div className="text-[11.5px] text-muted">{r.invoiceNumber ? `Inv. ${r.invoiceNumber}` : "—"}</div>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", render: (r) => <span className="text-[13px] text-text-2">{r.supplierName}</span> },
    { key: "branch", header: "Branch", render: (r) => <span className="text-[12.5px] text-text-2">{r.warehouseName ?? "—"}</span> },
    { key: "date", header: "Date", render: (r) => <span className="text-[12.5px] text-text-2">{formatShortDate(r.dateSupplied)}</span> },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (r) => <span className="font-mono text-[13px]">{r.totalQuantity}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => <span className="font-mono text-[13px] font-bold">{formatMoney(r.totalAmount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const style = STATUS_STYLE[r.status];
        return (
          <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold" style={style}>
            {style?.label ?? r.status}
          </span>
        );
      },
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Supply Records</div>
          <div className="mt-[3px] text-text-2">Every delivery received from your suppliers.</div>
        </div>
        {isManager && (
          <Link
            href="/inventory/supply-records/new"
            className="flex h-[37px] items-center rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New supply record
          </Link>
        )}
      </div>

      <div className="mb-[18px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: c.bg }}>
                {c.icon}
              </span>
              <span className="text-[12px] font-semibold text-text-2">{c.label}</span>
            </div>
            <div className="truncate font-mono text-[17px] font-bold tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>

      {costTrend.length > 0 && (
        <div className="mb-[18px] rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Monthly supply cost</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Last 12 months</div>
          <div className="mt-1.5 h-[150px] w-full">
            <AreaChart
              months={costTrend.map((c) => c.month.slice(5))}
              series={[{ key: "cost", color: "var(--accent)", values: costTrend.map((c) => c.totalAmount) }]}
              idPrefix="supply-cost"
              height={150}
            />
          </div>
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier, invoice #, or reference…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => pushParams({ status: e.target.value })}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text-2"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([value, s]) => (
            <option key={value} value={value}>
              {s.label}
            </option>
          ))}
        </select>
        {warehouses.length > 0 && (
          <select
            value={filters.warehouse}
            onChange={(e) => pushParams({ warehouse: e.target.value })}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text-2"
          >
            <option value="">All branches</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => exportToCsv(rows, exportColumns, "supply-records")}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-hover"
          >
            CSV
          </button>
          <button
            onClick={() => exportToExcel(rows, exportColumns, "supply-records")}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-hover"
          >
            Excel
          </button>
          <button
            onClick={() => exportToPdf("Supply Records", rows, exportColumns, "supply-records")}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-hover"
          >
            PDF
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/inventory/supply-records/${r.id}`)}
        pageSize={Math.max(pageSize, rows.length)}
        emptyState={<EmptyState compact icon="📦" title="No supply records match your search" description="Try adjusting your search or filters." />}
      />

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            Page {page} of {pageCount} · {total} total
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => pushParams({ page: page - 1 })}
              disabled={page <= 1}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => pushParams({ page: page + 1 })}
              disabled={page >= pageCount}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
