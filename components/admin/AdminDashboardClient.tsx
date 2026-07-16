"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { suspendOrgSubscription, reactivateOrgSubscription } from "@/lib/actions/platform-admin";
import { SubscriptionStatusBadge } from "@/components/billing/SubscriptionStatusBadge";
import { formatMoney } from "@/lib/currency";
import type { PlatformStats, OrgSubscriptionRow } from "@/lib/queries/platform-admin";
import type { SubscriptionStatus } from "@/lib/supabase/database.types";

interface Props {
  stats: PlatformStats;
  rows: OrgSubscriptionRow[];
  query: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STAT_TILES: { key: keyof PlatformStats; label: string; format?: "money" }[] = [
  { key: "totalSubscribers", label: "Total subscribers" },
  { key: "trialUsers", label: "Trial users" },
  { key: "monthlySubscribers", label: "Monthly subscribers" },
  { key: "yearlySubscribers", label: "Yearly subscribers" },
  { key: "totalRevenue", label: "Total revenue", format: "money" },
  { key: "renewalsLast30Days", label: "Renewals (30d)" },
  { key: "expiredUsers", label: "Expired" },
  { key: "cancelledPlans", label: "Cancelled" },
];

export function AdminDashboardClient({ stats, rows, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flash = useToast();
  const [q, setQ] = useState(query);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleSuspend(orgId: string) {
    setBusyOrgId(orgId);
    try {
      await suspendOrgSubscription(orgId);
      flash("Subscription suspended.");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not suspend subscription.");
    } finally {
      setBusyOrgId(null);
    }
  }

  async function handleReactivate(orgId: string) {
    setBusyOrgId(orgId);
    try {
      await reactivateOrgSubscription(orgId);
      flash("Subscription reactivated.");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not reactivate subscription.");
    } finally {
      setBusyOrgId(null);
    }
  }

  return (
    <div className="animate-fade-up p-6">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Platform subscriptions</div>
        <div className="mt-[3px] text-text-2">Cross-org billing overview — visible only to platform admins.</div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_TILES.map((tile) => (
          <div key={tile.key} className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.03em] text-muted">{tile.label}</div>
            <div className="mt-1 text-[22px] font-bold">
              {tile.format === "money" ? formatMoney(stats[tile.key] as number, "NGN") : stats[tile.key]}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={runSearch} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by org name or owner email…"
          className="h-[42px] flex-1 rounded-[9px] border border-border bg-surface px-[13px] text-[14px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="h-[42px] rounded-[9px] border-none bg-accent px-4 text-[14px] font-semibold text-white"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-3 border-b border-border-2 px-4 py-3 text-[11.5px] font-bold uppercase tracking-[0.03em] text-muted">
          <span>Organization</span>
          <span>Owner</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Renews / trial ends</span>
          <span></span>
        </div>
        {rows.map((row) => {
          const canSuspend = ["trialing", "active", "past_due"].includes(row.status);
          const canReactivate = ["cancelled", "expired", "suspended"].includes(row.status);
          return (
            <div
              key={row.orgId}
              className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] items-center gap-3 border-t border-border-2 px-4 py-3 text-[13px]"
            >
              <span className="font-semibold">{row.orgName}</span>
              <span className="text-text-2">{row.ownerEmail ?? "—"}</span>
              <span className="capitalize">{row.planKey}</span>
              <SubscriptionStatusBadge status={row.status as SubscriptionStatus} />
              <span className="text-text-2">{formatDate(row.currentPeriodEnd ?? row.trialEndsAt)}</span>
              <div className="flex justify-end gap-2">
                {canSuspend && (
                  <button
                    type="button"
                    disabled={busyOrgId !== null}
                    onClick={() => handleSuspend(row.orgId)}
                    className="rounded-[7px] border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-red disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyOrgId === row.orgId ? "…" : "Suspend"}
                  </button>
                )}
                {canReactivate && (
                  <button
                    type="button"
                    disabled={busyOrgId !== null}
                    onClick={() => handleReactivate(row.orgId)}
                    className="rounded-[7px] border-none bg-accent px-2.5 py-1 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyOrgId === row.orgId ? "…" : "Reactivate"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted">No results.</div>}
      </div>
    </div>
  );
}
