"use client";

import { useWorkspace } from "@/components/app/CurrencyProvider";
import { ExportMenu } from "@/components/ui/ExportMenu";
import type { ProfitLoss } from "@/lib/queries/reports";

function Row({ label, value, format, bold, negative }: { label: string; value: number; format: (n: number) => string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-border-2 py-3 last:border-0 ${bold ? "text-[15px] font-bold" : "text-[13.5px]"}`}>
      <span className={bold ? "text-text" : "text-text-2"}>{label}</span>
      <span className={negative ? "text-red" : bold ? "text-text" : "text-text"}>
        {negative && value !== 0 ? `-${format(Math.abs(value))}` : format(value)}
      </span>
    </div>
  );
}

export function ProfitLossClient({ data, from, to }: { data: ProfitLoss; from: string; to: string }) {
  const { format } = useWorkspace();

  const exportColumns = [
    { key: "metric", header: "Metric", value: (r: { metric: string; value: string }) => r.metric },
    { key: "value", header: "Amount", value: (r: { metric: string; value: string }) => r.value },
  ];
  const exportRows = [
    { metric: "Total Revenue", value: format(data.revenue) },
    { metric: "Cost of Goods Sold (COGS)", value: format(data.cogs) },
    { metric: "Gross Profit", value: format(data.grossProfit) },
    { metric: "Operating Expenses", value: format(data.operatingExpenses) },
    { metric: "Net Profit", value: format(data.netProfit) },
    { metric: "Profit Margin %", value: `${data.marginPct}%` },
  ];

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[12.5px] text-muted">
          {from} → {to}
        </p>
        <ExportMenu rows={exportRows} columns={exportColumns} filenameBase="profit-and-loss" pdfTitle="Profit & Loss Statement" />
      </div>
      <div className="max-w-[560px] rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <Row label="Total Revenue" value={data.revenue} format={format} />
        <Row label="Cost of Goods Sold (COGS)" value={data.cogs} format={format} negative />
        <Row label="Gross Profit" value={data.grossProfit} format={format} bold />
        <Row label="Operating Expenses" value={data.operatingExpenses} format={format} negative />
        <Row label="Net Profit" value={data.netProfit} format={format} bold />
        <div className="flex items-center justify-between pt-3 text-[13.5px]">
          <span className="text-text-2">Profit Margin</span>
          <span className={`font-bold ${data.marginPct >= 0 ? "text-green" : "text-red"}`}>{data.marginPct}%</span>
        </div>
      </div>
      <p className="mt-3 max-w-[560px] text-[11.5px] text-muted">
        Operating expenses are tracked org-wide (not per branch/product), so branch or product filters only narrow Revenue and COGS above.
      </p>
    </div>
  );
}
