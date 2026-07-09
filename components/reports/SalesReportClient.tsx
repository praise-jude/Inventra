"use client";

import { useWorkspace } from "@/components/app/CurrencyProvider";
import { Table, type TableColumn } from "@/components/ui/Table";
import { ExportMenu } from "@/components/ui/ExportMenu";
import type { Granularity, SalesByBranchRow, SalesByProductRow, SalesByStaffRow, SalesPeriodRow, SalesSummary } from "@/lib/queries/reports";

export interface SalesReportData {
  summary: SalesSummary;
  byPeriod: SalesPeriodRow[];
  byBranch: SalesByBranchRow[];
  byProduct: SalesByProductRow[];
  byStaff: SalesByStaffRow[];
}

const GRANULARITY_LABEL: Record<Granularity, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };

function periodLabel(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "year") return d.getFullYear().toString();
  if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function SalesReportClient({ data, granularity }: { data: SalesReportData; granularity: Granularity }) {
  const { format } = useWorkspace();

  const periodColumns: TableColumn<SalesPeriodRow>[] = [
    { key: "period", header: GRANULARITY_LABEL[granularity], sortable: true, sortValue: (r) => r.period, render: (r) => periodLabel(r.period, granularity) },
    { key: "count", header: "Sales", align: "right", sortable: true, sortValue: (r) => r.salesCount, render: (r) => r.salesCount },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (r) => r.revenue, render: (r) => format(r.revenue) },
    { key: "profit", header: "Profit", align: "right", sortable: true, sortValue: (r) => r.profit, render: (r) => format(r.profit) },
  ];

  const branchColumns: TableColumn<SalesByBranchRow>[] = [
    { key: "branch", header: "Branch", sortable: true, sortValue: (r) => r.warehouseName, render: (r) => r.warehouseName },
    { key: "count", header: "Sales", align: "right", sortable: true, sortValue: (r) => r.salesCount, render: (r) => r.salesCount },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (r) => r.revenue, render: (r) => format(r.revenue) },
  ];

  const productColumns: TableColumn<SalesByProductRow>[] = [
    { key: "name", header: "Product", sortable: true, sortValue: (r) => r.name, render: (r) => `${r.name} · ${r.sku}` },
    { key: "units", header: "Units", align: "right", sortable: true, sortValue: (r) => r.units, render: (r) => r.units },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (r) => r.revenue, render: (r) => format(r.revenue) },
    { key: "profit", header: "Profit", align: "right", sortable: true, sortValue: (r) => r.profit, render: (r) => format(r.profit) },
  ];

  const staffColumns: TableColumn<SalesByStaffRow>[] = [
    { key: "name", header: "Staff", sortable: true, sortValue: (r) => r.staffName, render: (r) => r.staffName },
    { key: "count", header: "Sales", align: "right", sortable: true, sortValue: (r) => r.salesCount, render: (r) => r.salesCount },
    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (r) => r.revenue, render: (r) => format(r.revenue) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Revenue" value={format(data.summary.revenue)} />
        <SummaryCard label="Discounts" value={format(data.summary.discount)} />
        <SummaryCard label="Tax" value={format(data.summary.tax)} />
        <SummaryCard label="Sales" value={String(data.summary.salesCount)} />
        <SummaryCard label="Profit" value={format(data.summary.profit)} accent />
      </div>

      <Section title={`${GRANULARITY_LABEL[granularity]} sales`} rows={data.byPeriod} columns={periodColumns} rowKey={(r) => r.period} filenameBase="sales-by-period" pdfTitle="Sales Report — by period" exportColumns={[
        { key: "period", header: GRANULARITY_LABEL[granularity], value: (r: SalesPeriodRow) => periodLabel(r.period, granularity) },
        { key: "count", header: "Sales", value: (r: SalesPeriodRow) => r.salesCount },
        { key: "revenue", header: "Revenue", value: (r: SalesPeriodRow) => r.revenue },
        { key: "profit", header: "Profit", value: (r: SalesPeriodRow) => r.profit },
      ]} />

      <Section title="Sales by branch" rows={data.byBranch} columns={branchColumns} rowKey={(r) => r.warehouseId} filenameBase="sales-by-branch" pdfTitle="Sales Report — by branch" exportColumns={[
        { key: "branch", header: "Branch", value: (r: SalesByBranchRow) => r.warehouseName },
        { key: "count", header: "Sales", value: (r: SalesByBranchRow) => r.salesCount },
        { key: "revenue", header: "Revenue", value: (r: SalesByBranchRow) => r.revenue },
      ]} />

      <Section title="Sales by product" rows={data.byProduct} columns={productColumns} rowKey={(r) => r.productId} filenameBase="sales-by-product" pdfTitle="Sales Report — by product" exportColumns={[
        { key: "name", header: "Product", value: (r: SalesByProductRow) => `${r.name} (${r.sku})` },
        { key: "units", header: "Units", value: (r: SalesByProductRow) => r.units },
        { key: "revenue", header: "Revenue", value: (r: SalesByProductRow) => r.revenue },
        { key: "profit", header: "Profit", value: (r: SalesByProductRow) => r.profit },
      ]} />

      <Section title="Sales by staff" rows={data.byStaff} columns={staffColumns} rowKey={(r) => r.staffId ?? r.staffName} filenameBase="sales-by-staff" pdfTitle="Sales Report — by staff" exportColumns={[
        { key: "name", header: "Staff", value: (r: SalesByStaffRow) => r.staffName },
        { key: "count", header: "Sales", value: (r: SalesByStaffRow) => r.salesCount },
        { key: "revenue", header: "Revenue", value: (r: SalesByStaffRow) => r.revenue },
      ]} />
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-3.5 shadow-[var(--shadow-sm)]">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</div>
      <div className={`mt-1 text-[19px] font-bold ${accent ? "text-accent-text" : "text-text"}`}>{value}</div>
    </div>
  );
}

function Section<T>({
  title,
  rows,
  columns,
  rowKey,
  filenameBase,
  pdfTitle,
  exportColumns,
}: {
  title: string;
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (r: T) => string;
  filenameBase: string;
  pdfTitle: string;
  exportColumns: { key: string; header: string; value: (r: T) => string | number }[];
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[14.5px] font-bold">{title}</h3>
        <ExportMenu rows={rows} columns={exportColumns} filenameBase={filenameBase} pdfTitle={pdfTitle} />
      </div>
      <Table columns={columns} rows={rows} rowKey={rowKey} pageSize={10} emptyState="No sales in this period." />
    </div>
  );
}
