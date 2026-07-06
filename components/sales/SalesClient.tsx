"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { fetchSaleDetail } from "@/lib/actions/sales";
import { SaleDetailSlideOver } from "@/components/sales/SaleDetailSlideOver";
import type { SaleListRow, SaleDetail } from "@/lib/queries/sales";
import type { CustomerOption } from "@/lib/queries/customers";

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

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Customer</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Items</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Payment</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Date</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => fetchSaleDetail(s.id).then((d) => d && setDetail(d))}
                  className="cursor-pointer border-t border-border-2 hover:bg-hover"
                >
                  <td className="px-4 py-3 text-[13.5px] font-semibold">{s.customerName}</td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13px]">{s.itemCount}</td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">{s.paymentSummary}</td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">{formatDateTime(s.createdAt)}</td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13px] font-bold">{formatMoney(s.total)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted">
                    No sales match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <SaleDetailSlideOver sale={detail} customers={customers} canDelete={canDelete} onClose={closeDetail} />}
    </div>
  );
}
