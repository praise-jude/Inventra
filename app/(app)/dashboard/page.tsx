import Link from "next/link";
import {
  getKpis,
  getCategoryMix,
  getTopSellers,
  getStockHealth,
  getMonthlyRevenueProfit,
  getMonthlySalesVolume,
  getRecentActivity,
  getDailyProductProfit,
} from "@/lib/queries/dashboard";
import type { ActivityRow } from "@/lib/queries/dashboard";
import { getExpenseCategoryBreakdown } from "@/lib/queries/expenses";
import { requireProfile } from "@/lib/queries/session";
import { getTeamMembers } from "@/lib/queries/team";
import { AreaChart } from "@/components/charts/AreaChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { TeamPresenceCard } from "@/components/team/TeamPresenceCard";
import { DailyProfitTable } from "@/components/dashboard/DailyProfitTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatNumber, formatPct, pctDelta } from "@/lib/format";
import { formatTodayHeader, formatCurrentTime, greetingFor } from "@/lib/datetime";
import { countryName } from "@/lib/geo/countries";
import { MOVEMENT_META } from "@/lib/movement-meta";
import { isManagerRole } from "@/lib/roles";
import { STOCK_STATUS_COLORS } from "@/lib/stock-status";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "expiring" is a synthetic 4th bucket from get_stock_health() (expiry_date
// based), not a real products.status value, so it isn't part of the shared
// stock-status colors — only its own local entry here.
const STOCK_HEALTH_META: Record<string, { label: string; color: string }> = {
  in_stock: { label: "Healthy stock", color: STOCK_STATUS_COLORS.in_stock.color },
  low_stock: { label: "Low stock", color: STOCK_STATUS_COLORS.low_stock.color },
  out_of_stock: { label: "Out of stock", color: STOCK_STATUS_COLORS.out_of_stock.color },
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
  const isAdminTier = isManagerRole(profile.role);
  const [kpis, categoryMix, topSellers, stockHealth, revenueProfit, salesVolume, expenseBreakdown, activity, dailyProfit, teamMembers] =
    await Promise.all([
      getKpis(),
      isAdminTier ? getCategoryMix() : Promise.resolve([]),
      getTopSellers(5),
      getStockHealth(),
      isAdminTier ? getMonthlyRevenueProfit() : Promise.resolve([]),
      isAdminTier ? getMonthlySalesVolume() : Promise.resolve([]),
      isAdminTier ? getExpenseCategoryBreakdown(org.timezone) : Promise.resolve([]),
      getRecentActivity(5),
      isAdminTier ? getDailyProductProfit() : Promise.resolve([]),
      isAdminTier ? getTeamMembers() : Promise.resolve([]),
    ]);
  const todaysProfit = dailyProfit.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);

  const totalCategoryValue = categoryMix.reduce((sum, c) => sum + Number(c.value), 0);
  const totalExpenseValue = expenseBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const totalStock = stockHealth.reduce(
    (sum, s) => (s.label === "expiring" ? sum : sum + Number(s.count)),
    0,
  );

  // Revenue/profit and sales-volume are each sparse (only months with real
  // activity come back from the DB) and fetched independently, so they can't
  // just be zipped together positionally — build one canonical last-12-months
  // axis and look every series up against it, defaulting missing months to 0.
  // This also means new orgs with little or no history get a real 12-month
  // chart instead of a blank one.
  const monthCursor = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
  const canonicalMonths: { key: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    canonicalMonths.push({
      key: `${monthCursor.getUTCFullYear()}-${String(monthCursor.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MONTH_NAMES[monthCursor.getUTCMonth()],
    });
    monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
  }
  const revenueByMonth = new Map(revenueProfit.map((m) => [m.month.slice(0, 7), m.revenue]));
  const profitByMonth = new Map(revenueProfit.map((m) => [m.month.slice(0, 7), m.profit]));
  const salesByMonth = new Map(salesVolume.map((m) => [m.month.slice(0, 7), m.count]));

  const chartMonths = canonicalMonths.map((m) => m.label);
  const revenueValues = canonicalMonths.map((m) => revenueByMonth.get(m.key) ?? 0);
  const profitValues = canonicalMonths.map((m) => profitByMonth.get(m.key) ?? 0);
  const salesVolumeValues = canonicalMonths.map((m) => salesByMonth.get(m.key) ?? 0);

  const kpiCards = [
    { label: "Total products", value: formatNumber(kpis.total_products), icon: "📦", iconBg: "var(--accent-weak)", sub: "active SKUs", delta: null as string | null, deltaColor: "", adminOnly: false, tier: "primary" as const },
    {
      label: "Today's revenue",
      value: formatMoney(kpis.today_revenue, org.currency),
      icon: "💰",
      iconBg: "var(--green-weak)",
      sub: "vs yesterday",
      delta: formatPct(pctDelta(kpis.today_revenue, kpis.yesterday_revenue)),
      deltaColor: kpis.today_revenue >= kpis.yesterday_revenue ? "var(--green)" : "var(--red)",
      adminOnly: true,
      tier: "primary" as const,
    },
    {
      label: "Monthly profit",
      value: kpis.monthly_profit !== null ? formatMoney(kpis.monthly_profit, org.currency) : "—",
      icon: "📈",
      iconBg: "var(--sky-weak)",
      sub: "vs last month",
      delta: formatPct(pctDelta(kpis.monthly_profit ?? 0, kpis.prior_monthly_profit)),
      deltaColor:
        (kpis.monthly_profit ?? 0) >= (kpis.prior_monthly_profit ?? 0) ? "var(--green)" : "var(--red)",
      adminOnly: true,
      tier: "primary" as const,
    },
    {
      label: "Total inventory value",
      value: formatMoney(kpis.total_inventory_value ?? 0, org.currency),
      icon: "💎",
      iconBg: "var(--green-weak)",
      sub: "selling price × stock",
      delta: null,
      deltaColor: "",
      adminOnly: true,
      tier: "primary" as const,
    },
    {
      label: "Total expected profit",
      value: formatMoney(kpis.total_expected_profit ?? 0, org.currency),
      icon: "📊",
      iconBg: "var(--accent-weak)",
      sub: "if all stock sold",
      delta: null,
      deltaColor: "",
      adminOnly: true,
      tier: "primary" as const,
    },
    { label: "Low stock", value: formatNumber(kpis.low_stock_count), icon: "⚠️", iconBg: "var(--amber-weak)", sub: "need reorder", delta: null, deltaColor: "", adminOnly: false, tier: "primary" as const },
    { label: "Out of stock", value: formatNumber(kpis.out_of_stock_count), icon: "⛔", iconBg: "var(--red-weak)", sub: "SKUs", delta: null, deltaColor: "", adminOnly: false, tier: "primary" as const },
    {
      label: "Total inventory cost",
      value: formatMoney(kpis.total_inventory_cost ?? 0, org.currency),
      icon: "🧾",
      iconBg: "var(--sky-weak)",
      sub: "purchase price × stock",
      delta: null,
      deltaColor: "",
      adminOnly: true,
      tier: "secondary" as const,
    },
    { label: "Total stock quantity", value: formatNumber(kpis.total_stock_qty ?? 0), icon: "🔢", iconBg: "var(--accent-weak)", sub: "units on hand", delta: null, deltaColor: "", adminOnly: false, tier: "secondary" as const },
    { label: "Active suppliers", value: formatNumber(kpis.active_suppliers), icon: "🚚", iconBg: "var(--accent-weak)", sub: "onboarded", delta: null, deltaColor: "", adminOnly: false, tier: "secondary" as const },
  ].filter((card) => isAdminTier || !card.adminOnly);
  const primaryKpis = kpiCards.filter((c) => c.tier === "primary");
  const secondaryKpis = kpiCards.filter((c) => c.tier === "secondary");

  const today = formatTodayHeader(org.timezone);
  const currentTime = formatCurrentTime(org.timezone);
  const greeting = greetingFor(org.timezone);
  const location = [org.state, org.country ? countryName(org.country) : null].filter(Boolean).join(", ");

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">
            {greeting.emoji} {greeting.label}, {profile.first_name}
          </div>
          <div className="mt-[3px] text-text-2">
            {today} · {currentTime}
            {location ? ` · ${location}` : ""}
          </div>
        </div>
        <Link
          href="/products?new=1"
          className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Quick add
        </Link>
      </div>

      {/* KPI GRID */}
      <div className="kpi-grid mb-[13px] grid gap-[13px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {primaryKpis.map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-[14px] border border-border bg-surface p-[15px_16px] shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-text-2">{k.label}</span>
              <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[13px]" style={{ background: k.iconBg }}>
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

      {secondaryKpis.length > 0 && (
        <div className="mb-[22px] grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
          {secondaryKpis.map((k) => (
            <div key={k.label} className="flex items-center gap-2.5 rounded-[11px] border border-border-2 bg-surface-2 px-3 py-2.5">
              <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] text-[12px]" style={{ background: k.iconBg }}>
                {k.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-muted">{k.label}</div>
                <div className="font-mono text-[14px] font-bold">{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TREND ROW */}
      {isAdminTier && (
      <div className="chart-row mb-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Sales trend</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Transactions · last 12 months</div>
          <div className="mt-1.5 h-[150px] w-full">
            <AreaChart
              months={chartMonths}
              series={[{ key: "sales", color: "var(--sky)", values: salesVolumeValues }]}
              idPrefix="sales"
              height={150}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Revenue trend</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Last 12 months</div>
          <div className="mt-1.5 h-[150px] w-full">
            <AreaChart
              months={chartMonths}
              series={[{ key: "revenue", color: "var(--accent)", values: revenueValues }]}
              idPrefix="revenue"
              height={150}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Monthly profit</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Last 12 months</div>
          <div className="mt-1.5 h-[150px] w-full">
            <AreaChart
              months={chartMonths}
              series={[{ key: "profit", color: "var(--green)", values: profitValues }]}
              idPrefix="profit"
              height={150}
            />
          </div>
        </div>
      </div>
      )}

      {/* BREAKDOWN ROW */}
      {isAdminTier && (
      <div className="chart-row mb-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Category mix</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Share of inventory value</div>
          <div className="flex flex-1 items-center gap-3.5">
            <div className="h-[130px] w-[130px] flex-shrink-0">
              <DonutChart data={categoryMix} totalLabel={formatMoney(totalCategoryValue, org.currency)} />
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {categoryMix.length === 0 && (
                <EmptyState compact icon="🗂️" title="No inventory value yet" description="Add products to see category share." />
              )}
              {categoryMix.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]"
                    style={{ background: ["#2563eb", "#10b981", "#0891b2", "#f59e0b", "#ef4444", "#8a94a8"][i % 6] }}
                  />
                  <span className="flex-1 text-text-2">{c.name}</span>
                  <span className="font-mono font-bold">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="text-[15px] font-bold">Expense breakdown</div>
          <div className="mb-1.5 text-[12.5px] text-muted">Last 30 days by category</div>
          <div className="flex flex-1 items-center gap-3.5">
            <div className="h-[130px] w-[130px] flex-shrink-0">
              <DonutChart
                data={expenseBreakdown.map((e) => ({ name: e.label, pct: e.pct }))}
                totalLabel={formatMoney(totalExpenseValue, org.currency)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {expenseBreakdown.length === 0 && (
                <EmptyState compact icon="💸" title="No expenses recorded" description="Log an expense to see the breakdown." />
              )}
              {expenseBreakdown.slice(0, 5).map((e, i) => (
                <div key={e.category} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]"
                    style={{ background: ["#2563eb", "#10b981", "#0891b2", "#f59e0b", "#ef4444", "#8a94a8"][i % 6] }}
                  />
                  <span className="flex-1 text-text-2">{e.label}</span>
                  <span className="font-mono font-bold">{e.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

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
            {topSellers.length === 0 && (
              <EmptyState compact icon="🧾" title="No sales yet" description="Top sellers will show up here once you record your first sale." />
            )}
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
                  {isAdminTier && <div className="font-mono text-[13px] font-bold">{formatMoney(p.revenue, org.currency)}</div>}
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
            {activity.length === 0 && (
              <EmptyState compact icon="🕒" title="No activity yet" description="Stock movements and edits will show up here as your team works." />
            )}
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
                      <b className="font-bold">{who}</b> {meta.verb}{" "}
                      {a.type === "transfer" ? productName : `${Math.abs(a.qty_delta)}× ${productName}`}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isAdminTier && (
        <div className="mt-4">
          <TeamPresenceCard members={teamMembers} showRoleBreakdown />
        </div>
      )}

      {/* DAILY PROFIT */}
      {isAdminTier && (
      <div className="mt-4 rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold">Today&apos;s profit by product</div>
            <div className="text-[12.5px] text-muted">Cost vs. sale price × units sold today</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Today&apos;s profit</div>
            <div className="font-mono text-[19px] font-bold" style={{ color: todaysProfit >= 0 ? "var(--green)" : "var(--red)" }}>
              {formatMoney(todaysProfit, org.currency)}
            </div>
          </div>
        </div>
        <DailyProfitTable rows={dailyProfit} currency={org.currency} />
      </div>
      )}
    </div>
  );
}
