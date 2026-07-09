"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { Table, type TableColumn } from "@/components/ui/Table";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import type { InventoryValuationRow } from "@/lib/queries/reports";

export function InventoryValuationClient({ rows }: { rows: InventoryValuationRow[] }) {
  const { format } = useWorkspace();

  const totalValue = useMemo(() => rows.reduce((sum, r) => sum + r.inventoryValue, 0), [rows]);
  const totalExpectedProfit = useMemo(() => rows.reduce((sum, r) => sum + r.expectedProfit, 0), [rows]);
  const totalUnits = useMemo(() => rows.reduce((sum, r) => sum + r.qtyOnHand, 0), [rows]);

  const columns: TableColumn<InventoryValuationRow>[] = [
    { key: "name", header: "Product", sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-semibold">{r.name} · {r.sku}</span> },
    { key: "branch", header: "Warehouse/Branch", sortable: true, sortValue: (r) => r.warehouseName ?? "", render: (r) => r.warehouseName ?? "Unassigned" },
    { key: "qty", header: "Stock Qty", align: "right", sortable: true, sortValue: (r) => r.qtyOnHand, render: (r) => r.qtyOnHand },
    { key: "cost", header: "Unit Cost", align: "right", sortable: true, sortValue: (r) => r.costPrice, render: (r) => format(r.costPrice) },
    { key: "sell", header: "Unit Price", align: "right", sortable: true, sortValue: (r) => r.sellPrice, render: (r) => format(r.sellPrice) },
    { key: "value", header: "Inventory Value", align: "right", sortable: true, sortValue: (r) => r.inventoryValue, render: (r) => format(r.inventoryValue) },
    { key: "profit", header: "Expected Profit", align: "right", sortable: true, sortValue: (r) => r.expectedProfit, render: (r) => format(r.expectedProfit) },
  ];

  const exportColumns = [
    { key: "name", header: "Product", value: (r: InventoryValuationRow) => `${r.name} (${r.sku})` },
    { key: "branch", header: "Warehouse/Branch", value: (r: InventoryValuationRow) => r.warehouseName ?? "Unassigned" },
    { key: "qty", header: "Stock Qty", value: (r: InventoryValuationRow) => r.qtyOnHand },
    { key: "cost", header: "Unit Cost", value: (r: InventoryValuationRow) => r.costPrice },
    { key: "sell", header: "Unit Price", value: (r: InventoryValuationRow) => r.sellPrice },
    { key: "value", header: "Inventory Value", value: (r: InventoryValuationRow) => r.inventoryValue },
    { key: "profit", header: "Expected Profit", value: (r: InventoryValuationRow) => r.expectedProfit },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Total Inventory Value</div>
          <div className="mt-1 text-[22px] font-bold text-accent-text">{format(totalValue)}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Total Expected Profit</div>
          <div className="mt-1 text-[22px] font-bold">{format(totalExpectedProfit)}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Total Units on Hand</div>
          <div className="mt-1 text-[22px] font-bold">{totalUnits.toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-2.5 flex justify-end">
        <ExportMenu rows={rows} columns={exportColumns} filenameBase="inventory-valuation" pdfTitle="Inventory Valuation Report" />
      </div>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.productId}
        pageSize={20}
        search={{ placeholder: "Search product…", filter: (r, q) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) }}
        emptyState={<EmptyState icon="📦" title="No products" description="Add products with stock on hand to see their valuation here." />}
      />
    </div>
  );
}
