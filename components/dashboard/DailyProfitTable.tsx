"use client";

import { useMemo } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatNumber } from "@/lib/format";
import type { DailyProductProfitRow } from "@/lib/supabase/database.types";

export function DailyProfitTable({ rows, currency }: { rows: DailyProductProfitRow[]; currency: string }) {
  const columns: TableColumn<DailyProductProfitRow>[] = useMemo(() => [
    {
      key: "name",
      header: "Product",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <span className="font-semibold">
          {p.emoji || "📦"} {p.name}
        </span>
      ),
    },
    {
      key: "units",
      header: "Units sold",
      align: "right",
      sortable: true,
      sortValue: (p) => Number(p.units) || 0,
      render: (p) => <span className="font-mono">{formatNumber(Number(p.units) || 0)}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      sortable: true,
      sortValue: (p) => Number(p.revenue) || 0,
      render: (p) => <span className="font-mono">{formatMoney(Number(p.revenue) || 0, currency)}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      sortable: true,
      sortValue: (p) => Number(p.cost) || 0,
      render: (p) => <span className="font-mono text-text-2">{formatMoney(Number(p.cost) || 0, currency)}</span>,
    },
    {
      key: "profit",
      header: "Profit",
      align: "right",
      sortable: true,
      sortValue: (p) => Number(p.profit) || 0,
      render: (p) => (
        <span className="font-mono font-bold" style={{ color: (Number(p.profit) || 0) >= 0 ? "var(--green)" : "var(--red)" }}>
          {formatMoney(Number(p.profit) || 0, currency)}
        </span>
      ),
    },
  ], [currency]);

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(p) => p.product_id}
      pageSize={8}
      search={rows.length > 8 ? { placeholder: "Search products…", filter: (p, q) => p.name.toLowerCase().includes(q) } : undefined}
      emptyState={<EmptyState compact icon="💰" title="No sales recorded today yet" description="Today's per-product profit will appear here once a sale is made." />}
    />
  );
}
