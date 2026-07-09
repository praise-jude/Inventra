"use client";

import { useRouter, usePathname } from "next/navigation";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { SalesReportClient, type SalesReportData } from "@/components/reports/SalesReportClient";
import { InventoryValuationClient } from "@/components/reports/InventoryValuationClient";
import { ProfitLossClient } from "@/components/reports/ProfitLossClient";
import type { Granularity, InventoryValuationRow, ProfitLoss } from "@/lib/queries/reports";

type Tab = "sales" | "valuation" | "pl";

const TABS: { key: Tab; label: string }[] = [
  { key: "sales", label: "Sales Report" },
  { key: "valuation", label: "Inventory Valuation" },
  { key: "pl", label: "Profit & Loss" },
];

interface Props {
  tab: Tab;
  from: string;
  to: string;
  branchId: string;
  productId: string;
  granularity: Granularity;
  branches: { id: string; name: string }[];
  products: { id: string; name: string; sku: string }[];
  salesData: SalesReportData | null;
  valuationData: InventoryValuationRow[] | null;
  plData: ProfitLoss | null;
}

export function ReportsClient({
  tab,
  from,
  to,
  branchId,
  productId,
  granularity,
  branches,
  products,
  salesData,
  valuationData,
  plData,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function pushParams(next: Record<string, string>) {
    const merged = { tab, from, to, branch: branchId, product: productId, granularity, ...next };
    const params = new URLSearchParams();
    params.set("tab", merged.tab);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.branch) params.set("branch", merged.branch);
    if (merged.product) params.set("product", merged.product);
    if (merged.granularity) params.set("granularity", merged.granularity);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-4 flex gap-1.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => pushParams({ tab: t.key })}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ${
              tab === t.key ? "border-accent text-accent-text" : "border-transparent text-text-2 hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        {tab !== "valuation" && <DateRangeFilter from={from} to={to} onChange={(f, t2) => pushParams({ from: f, to: t2 })} />}
        <select
          value={branchId}
          onChange={(e) => pushParams({ branch: e.target.value })}
          aria-label="Filter by branch"
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {tab === "sales" && (
          <select
            value={granularity}
            onChange={(e) => pushParams({ granularity: e.target.value })}
            aria-label="Group by"
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        )}
        {tab === "pl" && (
          <select
            value={productId}
            onChange={(e) => pushParams({ product: e.target.value })}
            aria-label="Filter by product"
            className="h-[37px] max-w-[220px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "sales" && salesData && <SalesReportClient data={salesData} granularity={granularity} />}
      {tab === "valuation" && valuationData && <InventoryValuationClient rows={valuationData} />}
      {tab === "pl" && plData && <ProfitLossClient data={plData} from={from} to={to} />}
    </div>
  );
}
