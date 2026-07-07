"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { fetchSaleDetail } from "@/lib/actions/sales";
import { SaleDetailSlideOver } from "@/components/sales/SaleDetailSlideOver";
import type { SaleListRow, SaleDetail } from "@/lib/queries/sales";
import type { CustomerOption } from "@/lib/queries/customers";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export function SalesClient({ sales, customers, canDelete }: { sales: SaleListRow[]; customers: CustomerOption[]; canDelete: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { format: formatMoney, formatDateTime } = useWorkspace();
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<SaleDetail | null>(null);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) fetchSaleDetail(openId).then((d) => d && setDetail(d));
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => s.customerName.toLowerCase().includes(q));
  }, [sales, query]);

  function closeDetail() {
    setDetail(null);
    router.replace("/sales");
  }

  const columns: TableColumn<SaleListRow>[] = [
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
  ];

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Sales</div>
          <div className="mt-[3px] text-text-2">{sales.length} transactions recorded.</div>
        </div>
        <Link
          href="/sales/new"
          className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New Sale
        </Link>
      </div>

      <div className="mb-3.5 flex h-[37px] items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer…"
          className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
        />
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        onRowClick={(s) => fetchSaleDetail(s.id).then((d) => d && setDetail(d))}
        pageSize={20}
        emptyState={<EmptyState compact icon="🧾" title="No sales match your search" description="Try adjusting your search terms." />}
      />

      {detail && <SaleDetailSlideOver sale={detail} customers={customers} canDelete={canDelete} onClose={closeDetail} />}
    </div>
  );
}
