"use client";

import { useState } from "react";
import { fetchDailySalesSummary, fetchSalesForDay } from "@/lib/actions/sales-summary";
import type { DailySalesSummaryRow, DaySaleRow } from "@/lib/queries/sales-summary";
import { useWorkspace } from "@/components/app/CurrencyProvider";

type Preset = "today" | "yesterday" | "7d" | "thisMonth" | "lastMonth" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Only ever called from a click handler (applyPreset), never in the initial
// render path — safe to read the real wall-clock time here, unlike in the
// component body itself (see the header comment on monthLabel/daysElapsed
// props below for why that distinction matters).
function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: isoDate(y), to: isoDate(y) };
    }
    case "7d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: isoDate(s), to: today };
    }
    case "thisMonth":
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "lastMonth": {
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: isoDate(lastMonthStart), to: isoDate(lastMonthEnd) };
    }
  }
}

// r.day is a fixed data string (never "now"), so this is safe to call
// unconditionally in the render path — it can't disagree between the
// server's render and the client's first render the way new Date() with no
// arguments could.
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</div>
      <div className="mt-0.5 text-[16px] font-bold">{value}</div>
    </div>
  );
}

export function SalesSummaryPanel({
  monthLabel,
  daysElapsedInMonth,
  initialMonthRows,
}: {
  // Computed server-side (page.tsx) rather than via new Date() in this
  // component's own render path — this renders unconditionally on first
  // paint, so if it read the client's wall clock instead, a pageload
  // landing exactly on a month/day boundary could disagree with what the
  // server already rendered and throw a hydration mismatch (React #418,
  // the exact bug fixed elsewhere in this codebase — this component avoids
  // reintroducing it).
  monthLabel: string;
  daysElapsedInMonth: number;
  initialMonthRows: DailySalesSummaryRow[];
}) {
  const { format } = useWorkspace();

  // The monthly card is always "this calendar month", independent of
  // whatever the daily list below is filtered to — derived once from the
  // rows the page already fetched for the current month, never refetched.
  const monthTotal = initialMonthRows.reduce((sum, r) => sum + r.totalSales, 0);
  const monthTransactions = initialMonthRows.reduce((sum, r) => sum + r.salesCount, 0);
  const avgDaily = daysElapsedInMonth > 0 ? monthTotal / daysElapsedInMonth : 0;
  const daysWithSales = initialMonthRows.filter((r) => r.salesCount > 0);
  const highestDay = daysWithSales.length > 0 ? Math.max(...daysWithSales.map((r) => r.totalSales)) : null;
  const lowestDay = daysWithSales.length > 0 ? Math.min(...daysWithSales.map((r) => r.totalSales)) : null;

  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dailyRows, setDailyRows] = useState<DailySalesSummaryRow[]>(initialMonthRows);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [daySales, setDaySales] = useState<DaySaleRow[] | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRange(from: string, to: string) {
    setExpandedDay(null);
    setDaySales(null);
    setError(null);
    setLoading(true);
    try {
      setDailyRows(await fetchDailySalesSummary(from, to));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the sales summary.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "custom") {
      // Wait for the user to actually pick both dates before fetching —
      // seeding the inputs from new Date() here would be the same client-
      // clock risk described above, and these inputs only ever render after
      // this client-only interaction anyway, well past the point where
      // hydration comparison matters.
      const today = isoDate(new Date());
      setCustomFrom(today);
      setCustomTo(today);
      return;
    }
    void loadRange(presetRange(next).from, presetRange(next).to);
  }

  function applyCustomRange(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    void loadRange(from, to);
  }

  async function toggleDay(day: string) {
    if (expandedDay === day) {
      setExpandedDay(null);
      setDaySales(null);
      return;
    }
    setExpandedDay(day);
    setDaySales(null);
    setDrillLoading(true);
    try {
      setDaySales(await fetchSalesForDay(day));
    } catch {
      setDaySales([]);
    } finally {
      setDrillLoading(false);
    }
  }

  // Newest first, matching the rest of the Audit Log's chronological order.
  const sortedRows = [...dailyRows].sort((a, b) => (a.day < b.day ? 1 : -1));

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="mb-3 text-[15px] font-bold">{monthLabel} — Sales Summary</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryStat label="Total Sales" value={format(monthTotal)} />
          <SummaryStat label="Transactions" value={monthTransactions.toLocaleString("en-US")} />
          <SummaryStat label="Average Daily Sales" value={format(avgDaily)} />
          <SummaryStat label="Highest Sales Day" value={highestDay !== null ? format(highestDay) : "—"} />
          <SummaryStat label="Lowest Sales Day" value={lowestDay !== null ? format(lowestDay) : "—"} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-[13.5px] font-semibold text-text-2">Daily breakdown</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`h-[33px] rounded-[8px] border px-2.5 text-[12px] font-semibold ${
                  preset === p.key ? "border-accent bg-accent-weak text-accent-text" : "border-border bg-surface text-text-2 hover:bg-hover"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" && (
          <div className="mb-3 flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => applyCustomRange(e.target.value, customTo)}
              aria-label="From date"
              className="h-[33px] rounded-[8px] border border-border bg-surface px-2 text-[12.5px] text-text"
            />
            <span className="text-[12px] text-muted">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => applyCustomRange(customFrom, e.target.value)}
              aria-label="To date"
              className="h-[33px] rounded-[8px] border border-border bg-surface px-2 text-[12.5px] text-text"
            />
          </div>
        )}

        {error && <div className="mb-3 rounded-[8px] border border-red bg-red-weak px-3 py-2 text-[12.5px] font-medium text-red">{error}</div>}

        {loading ? (
          <div className="py-6 text-center text-[13px] text-muted">Loading…</div>
        ) : sortedRows.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted">No sales in this range.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedRows.map((r) => (
              <div key={r.day} className="rounded-[10px] border border-border-2">
                <button
                  type="button"
                  onClick={() => toggleDay(r.day)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-hover"
                >
                  <span className="text-[12.5px] font-semibold">{dayLabel(r.day)}</span>
                  <span className="flex items-center gap-4 text-[12.5px]">
                    <span className="font-bold">{format(r.totalSales)}</span>
                    <span className="text-text-2">{r.salesCount.toLocaleString("en-US")} sales</span>
                    <span className="text-text-2">{r.itemsSold.toLocaleString("en-US")} items</span>
                    <span className="text-muted">{expandedDay === r.day ? "▲" : "▼"}</span>
                  </span>
                </button>

                {expandedDay === r.day && (
                  <div className="border-t border-border-2 px-3.5 py-2.5">
                    {drillLoading ? (
                      <div className="py-3 text-center text-[12.5px] text-muted">Loading sales…</div>
                    ) : !daySales || daySales.length === 0 ? (
                      <div className="py-3 text-center text-[12.5px] text-muted">No sales found for this day.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-left text-muted">
                              <th className="pb-1.5 pr-3 font-medium">Time</th>
                              <th className="pb-1.5 pr-3 font-medium">Customer</th>
                              <th className="pb-1.5 pr-3 font-medium">Cashier</th>
                              <th className="pb-1.5 pr-3 font-medium">Payment</th>
                              <th className="pb-1.5 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daySales.map((s) => (
                              <tr key={s.id} className="border-t border-border-2">
                                <td className="py-1.5 pr-3 font-mono text-muted">
                                  {new Date(s.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </td>
                                <td className="py-1.5 pr-3">{s.customerName}</td>
                                <td className="py-1.5 pr-3 text-text-2">{s.cashierName}</td>
                                <td className="py-1.5 pr-3 text-text-2">{s.paymentSummary}</td>
                                <td className="py-1.5 font-semibold">{format(s.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
