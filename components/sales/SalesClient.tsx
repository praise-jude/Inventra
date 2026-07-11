"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { fetchSaleDetail } from "@/lib/actions/sales";
import type { SaleListRow, SaleDetail } from "@/lib/queries/sales";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

const SaleDetailSlideOver = dynamic(() =>
  import("@/components/sales/SaleDetailSlideOver").then((m) => m.SaleDetailSlideOver),
);

interface SalesFiltersState {
  q: string;
  warehouse: string;
}

export function SalesClient({
  rows,
  total,
  page,
  pageSize,
  warehouses,
  canDelete,
  filters,
}: {
  rows: SaleListRow[];
  total: number;
  page: number;
  pageSize: number;
  warehouses: { id: string; name: string }[];
  canDelete: boolean;
  filters: SalesFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { format: formatMoney, formatDateTime } = useWorkspace();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);

  function pushParams(next: Partial<SalesFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
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

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) fetchSaleDetail(openId).then((d) => d && setDetail(d));
  }, [searchParams]);

  function closeDetail() {
    setDetail(null);
    router.replace("/sales");
  }

  const columns: TableColumn<SaleListRow>[] = useMemo(() => [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (s) => s.customerName,
      render: (s) => <span className="text-[13.5px] font-semibold">{s.customerName}</span>,
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      sortable: true,
      sortValue: (s) => s.itemCount,
      render: (s) => <span className="font-mono text-[13px]">{s.itemCount}</span>,
    },
    {
      key: "payment",
      header: "Payment",
      render: (s) => <span className="text-[12.5px] text-text-2">{s.paymentSummary}</span>,
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      sortValue: (s) => s.warehouseName ?? "",
      render: (s) => <span className="text-[12.5px] text-text-2">{s.warehouseName ?? "—"}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (s) => s.createdAt,
      render: (s) => <span className="text-[12.5px] text-text-2">{formatDateTime(s.createdAt)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (s) => s.total,
      render: (s) => <span className="font-mono text-[13px] font-bold">{formatMoney(s.total)}</span>,
    },
  ], [formatMoney, formatDateTime]);

  const showWarehouseFilter = warehouses.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Sales</div>
          <div className="mt-[3px] text-text-2">{total} transactions recorded.</div>
        </div>
        <Link
          href="/sales/new"
          className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New Sale
        </Link>
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        {showWarehouseFilter && (
          <select
            value={filters.warehouse}
            onChange={(e) => pushParams({ warehouse: e.target.value })}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
          >
            <option value="">All branches</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => fetchSaleDetail(s.id).then((d) => d && setDetail(d))}
        pageSize={Math.max(pageSize, rows.length)}
        emptyState={<EmptyState compact icon="🧾" title="No sales match your search" description="Try adjusting your search terms." />}
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

      {detail && <SaleDetailSlideOver sale={detail} canDelete={canDelete} onClose={closeDetail} />}
    </div>
  );
}
