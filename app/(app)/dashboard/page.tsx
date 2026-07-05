import Link from "next/link";
import {
  getKpis,
  getCategoryMix,
  getTopSellers,
  getStockHealth,
  getMonthlyStats,
  getRecentActivity,
  getDailyProductProfit,
} from "@/lib/queries/dashboard";
import type { ActivityRow } from "@/lib/queries/dashboard";
import { requireProfile } from "@/lib/queries/session";
import { AreaChart } from "@/components/charts/AreaChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatMoneyCompact, formatNumber, formatPct, pctDelta } from "@/lib/format";
import { formatTodayHeader } from "@/lib/datetime";
import { MOVEMENT_META } from "@/lib/movement-meta";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STOCK_HEALTH_META: Record<string, { label: string; color: string }> = {
  in_stock: { label: "Healthy stock", color: "var(--green)" },
  low_stock: { label: "Low stock", color: "var(--amber)" },
  out_of_stock: { label: "Out of stock", color: "var(--red)" },
  expiring: { label: "Expiring < 7 days", color: "var(--sky)" },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const { profile, org } = await requireProfile();
  const [kpis, categoryMix, topSellers, stockHealth, monthlyStats, activity, dailyProfit] = await Promise.all([
    getKpis(),
    getCategoryMix(),
    getTopSellers(5),
    getStockHealth(),
    getMonthlyStats(),
    getRecentActivity(5),
    getDailyProductProfit(),
  ]);
  const todaysProfit = dailyProfit.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);

  const totalCategoryValue = categoryMix.reduce((sum, c) => sum + Number(c.value), 0);
  const totalStock = stockHealth.reduce(
    (sum, s) => (s.label === "expiring" ? sum : sum + Number(s.count)),
    0,
  );

  const chartData = monthlyStats.map((m) => {
    const d = new Date(m.month);
    return { month: MONTH_NAMES[d.getUTCMonth()], revenue: Number(m.revenue), profit: Number(m.profit) };
  });

  const kpiCards = [
    { label: "Total products", value: formatNumber(kpis.total_products), icon: "📦", iconBg: "var(--accent-weak)", sub: "active SKUs", delta: null as string | null, deltaColor: "" },
    {
      label: "Today's revenue",
      value: formatMoneyCompact(kpis.today_revenue, org.currency),
      icon: "💰",
      iconBg: "var(--green-weak)",
      sub: "vs yesterday",
      delta: formatPct(pctDelta(kpis.today_revenue, kpis.yesterday_revenue)),
      deltaColor: kpis.today_revenue >= kpis.yesterday_revenue ? "var(--green)" : "var(--red)",
    },
    {
      label: "Monthly profit",
      value: kpis.monthly_profit !== null ? formatMoneyCompact(kpis.monthly_profit, org.currency) : "—",
      icon: "📈",
      iconBg: "var(--sky-weak)",
      sub: "vs last month",
      delta: formatPct(pctDelta(kpis.monthly_profit ?? 0, kpis.prior_monthly_profit)),
      deltaColor:
        (kpis.monthly_profit ?? 0) >= (kpis.prior_monthly_profit ?? 0) ? "var(--green)" : "var(--red)",
    },
    { label: "Low stock", value: formatNumber(kpis.low_stock_count), icon: "⚠️", iconBg: "var(--amber-weak)", sub: "need reorder", delta: null, deltaColor: "" },
    { label: "Out of stock", value: formatNumber(kpis.out_of_stock_count), icon: "⛔", iconBg: "var(--red-weak)", sub: "SKUs", delta: null, deltaColor: "" },
    { label: "Active suppliers", value: formatNumber(kpis.active_suppliers), icon: "🚚", iconBg: "var(--accent-weak)", sub: "onboarded", delta: null, deltaColor: "" },
  ];

  const today = formatTodayHeader(org.timezone);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Good morning, {profile.first_name} 👋</div>
          <div className="mt-[3px] text-text-2">Here&apos;s how your business is doing today — {today}.</div>
        </div>
        <Link
          href="/products?new=1"
          className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Quick add
        </Link>
      </div>

      {/* KPI GRID */}
      <div className="kpi-grid mb-[22px] grid gap-[13px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {kpiCards.map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-[14px] border border-border bg-surface p-[15px_16px] shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-text-2">{k.label}</span>
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[13px]" style={{ background: k.iconBg }}>
                {k.icon}
              </span>
            </div>
            <div className="mt-[9px] font-mono text-[25px] font-bold tracking-tight">{k.value}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {k.delta && (
                <span className="rounded-[6px] px-1.5 py-px text-[12px] font-bold" style={{ color: k.deltaColor, background: "color-mix(in srgb, " + k.deltaColor + " 15%, transparent)" }}>
                  {k.delta}
                </span>
              )}
              <span className="text-[11.5px] text-muted">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* CHART ROW */}
      <div className="chart-row mb-4 grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold">Revenue &amp; profit</div>
              <div className="text-[12.5px] text-muted">Last 12 months</div>
            </div>
            <div className="flex gap-3.5 text-xs">
              <span className="flex items-center gap-1.5 text-text-2">
                <span className="h-[9px] w-[9px] rounded-[3px] bg-accent" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-text-2">
                <span className="h-[9px] w-[9px] rounded-[3px] bg-green" />
                Profit
              </span>
            </div>
          </div>
          <div className="mt-1.5 h-[230px] w-full">
            <AreaChart data={chartData} />
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Category mix</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Share of inventory value</div>
          <div className="flex flex-1 items-center gap-3.5">
            <div className="h-[130px] w-[130px] flex-shrink-0">
              <DonutChart data={categoryMix} totalLabel={formatMoneyCompact(totalCategoryValue, org.currency)} />
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {categoryMix.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]"
                    style={{ background: ["#635bff", "#12805c", "#0e7cc4", "#b7791f", "#d5304a", "#8a94a8"][i % 6] }}
                  />
                  <span className="flex-1 text-text-2">{c.name}</span>
                  <span className="font-mono font-bold">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LOWER ROW */}
      <div className="lower-row grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="text-[15px] font-bold">Top sellers</div>
            <Link href="/products" className="text-[12.5px] font-semibold text-accent-text">
              View all
            </Link>
          </div>
          <div className="flex flex-col gap-[13px]">
            {topSellers.length === 0 && <p className="text-[12.5px] text-muted">No sales recorded yet.</p>}
            {topSellers.map((p) => (
              <div key={p.product_id} className="flex items-center gap-[11px]">
                <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[8px] bg-accent-weak text-[16px]">
                  {p.emoji || "📦"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{p.name}</div>
                  <div className="text-[11.5px] text-muted">{formatNumber(p.units)} sold</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] font-bold">{formatMoneyCompact(p.revenue, org.currency)}</div>
                  {p.trend_pct !== null && (
                    <div className="text-[11px] font-semibold" style={{ color: p.trend_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                      {formatPct(p.trend_pct, 0)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="mb-0.5 text-[15px] font-bold">Stock health</div>
          <div className="mb-4 text-[12.5px] text-muted">Across your catalog</div>
          <div className="flex flex-col gap-3.5">
            {stockHealth.map((s) => {
              const meta = STOCK_HEALTH_META[s.label];
              const base = s.label === "expiring" ? Math.max(totalStock, 1) : Math.max(totalStock, 1);
              const pct = Math.min(100, Math.round((Number(s.count) / base) * 100));
              return (
                <div key={s.label}>
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span className="font-semibold text-text-2">{meta.label}</span>
                    <span className="font-mono font-bold">{formatNumber(s.count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[6px] bg-border-2">
                    <div className="h-full rounded-[6px]" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="text-[15px] font-bold">Recent activity</div>
            <span className="h-[7px] w-[7px] rounded-full bg-green shadow-[0_0_0_3px_var(--green-weak)]" />
          </div>
          <div className="flex flex-col gap-0.5">
            {activity.length === 0 && <p className="text-[12.5px] text-muted">No activity yet.</p>}
            {activity.map((a: ActivityRow, i: number) => {
              const meta = MOVEMENT_META[a.type] ?? MOVEMENT_META.adjustment;
              const who = a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : "System";
              const productName = a.products?.name ?? "a product";
              return (
                <div key={a.id} className="flex gap-[11px] py-[5px]">
                  <div className="flex flex-col items-center">
                    <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] text-[12px]" style={{ background: meta.bg }}>
                      {meta.icon}
                    </div>
                    {i < activity.length - 1 && <div className="my-[3px] w-[1.5px] flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="text-[12.5px] leading-snug">
                      <b className="font-bold">{who}</b> {meta.verb} {Math.abs(a.qty_delta)}× {productName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DAILY PROFIT */}
      <div className="mt-4 rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold">Today&apos;s profit by product</div>
            <div className="text-[12.5px] text-muted">Cost vs. sale price × units sold today</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Today&apos;s profit</div>
            <div className="font-mono text-[19px] font-bold" style={{ color: todaysProfit >= 0 ? "var(--green)" : "var(--red)" }}>
              {formatMoneyCompact(todaysProfit, org.currency)}
            </div>
          </div>
        </div>
        {dailyProfit.length === 0 ? (
          <p className="text-[12.5px] text-muted">No sales recorded today yet.</p>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-3.5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                  <th className="px-3.5 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Units sold</th>
                  <th className="px-3.5 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Revenue</th>
                  <th className="px-3.5 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Cost</th>
                  <th className="px-3.5 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Profit</th>
                </tr>
              </thead>
              <tbody>
                {dailyProfit.map((p) => (
                  <tr key={p.product_id} className="border-t border-border-2">
                    <td className="px-3.5 py-2.5 text-[13px] font-semibold">
                      {p.emoji || "📦"} {p.name}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[13px]">{formatNumber(Number(p.units_sold) || 0)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[13px]">{formatMoneyCompact(Number(p.revenue) || 0, org.currency)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-text-2">{formatMoneyCompact(Number(p.cost) || 0, org.currency)}</td>
                    <td
                      className="px-3.5 py-2.5 text-right font-mono text-[13px] font-bold"
                      style={{ color: (Number(p.profit) || 0) >= 0 ? "var(--green)" : "var(--red)" }}
                    >
                      {formatMoneyCompact(Number(p.profit) || 0, org.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
