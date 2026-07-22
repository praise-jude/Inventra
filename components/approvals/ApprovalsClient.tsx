"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { decideApprovalRequest, type PendingApprovalRow } from "@/lib/actions/approvals";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const ENTITY_ICON: Record<string, string> = { discount: "🏷️", void_sale: "🗑️", price_change: "💲" };
const ENTITY_LABEL: Record<string, string> = { discount: "Discount", void_sale: "Void sale", price_change: "Price change" };

function summarize(request: PendingApprovalRow, formatMoney: (n: number) => string): string {
  const p = request.payload as Record<string, any>;
  if (request.entityType === "discount") {
    const computed = p.computed ?? {};
    return `${computed.maxDiscountPct ?? "?"}% discount on a sale of ${formatMoney(Number(computed.total ?? 0))}`;
  }
  if (request.entityType === "void_sale") {
    return `Void a sale worth ${formatMoney(Number(p.total ?? 0))}`;
  }
  if (request.entityType === "price_change") {
    const before = p.before ?? {};
    const input = p.input ?? {};
    return `"${before.name ?? "Product"}": cost ${formatMoney(Number(before.cost_price ?? 0))} → ${formatMoney(Number(input.costPrice ?? 0))}, sell ${formatMoney(Number(before.sell_price ?? 0))} → ${formatMoney(Number(input.sellPrice ?? 0))}`;
  }
  return "Requested change";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ApprovalsClient({ initialRequests }: { initialRequests: PendingApprovalRow[] }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();
  // hiddenIds (not a mirror of initialRequests) lets an approve/reject hide
  // a row instantly without needing an effect to resync local state to the
  // prop on every router.refresh() — the filter below just recomputes
  // against whatever initialRequests currently is on each render.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const requests = initialRequests.filter((r) => !hiddenIds.has(r.id));

  // Realtime so a request created (or decided on another device) shows up
  // here immediately — same pattern as NotificationsClient's channel.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("approval-requests:pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await decideApprovalRequest(id, "approved");
      flash("Approved");
      setHiddenIds((prev) => new Set(prev).add(id));
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not approve this request.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Reason for rejecting (optional):") ?? undefined;
    setBusyId(id);
    try {
      await decideApprovalRequest(id, "rejected", reason);
      flash("Rejected");
      setHiddenIds((prev) => new Set(prev).add(id));
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not reject this request.");
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return <EmptyState icon="✅" title="No pending approvals" description="Discount, void, and price-change requests will show up here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-surface p-4.5 shadow-[var(--shadow-sm)]">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-weak text-[16px]">
                {ENTITY_ICON[r.entityType] ?? "❓"}
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{ENTITY_LABEL[r.entityType] ?? r.entityType}</div>
                <div className="text-[12px] text-text-2">
                  {r.requestedByName} · {timeAgo(r.requestedAt)}
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3.5 text-[13.5px] text-text">{summarize(r, formatMoney)}</div>
          {r.reason && <div className="mb-3.5 rounded-[9px] bg-hover px-3 py-2 text-[12.5px] text-text-2">Note: {r.reason}</div>}
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => handleReject(r.id)} disabled={busyId === r.id}>
              Reject
            </Button>
            <Button onClick={() => handleApprove(r.id)} disabled={busyId === r.id}>
              {busyId === r.id ? "Working…" : "Approve"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
