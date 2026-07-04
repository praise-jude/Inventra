"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { deleteDebtor, fetchDebtorDetail } from "@/lib/actions/debtors";
import { DebtorModal } from "@/components/debtors/DebtorModal";
import { DebtorDetailSlideOver } from "@/components/debtors/DebtorDetailSlideOver";
import type { DebtorsOverview, DebtorRow, DebtorDetail } from "@/lib/queries/debtors";

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  pending: { color: "var(--sky)", background: "var(--sky-weak)" },
  partially_paid: { color: "var(--amber)", background: "var(--amber-weak)" },
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  overdue: { color: "var(--red)", background: "var(--red-weak)" },
  cancelled: { color: "var(--muted)", background: "var(--hover)" },
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function DebtorsClient({ overview, canDelete }: { overview: DebtorsOverview; canDelete: boolean }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalDebtor, setModalDebtor] = useState<DebtorRow | null | undefined>(undefined);
  const [detail, setDetail] = useState<DebtorDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overview.debtors.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (!q) return true;
      return d.customerName.toLowerCase().includes(q) || (d.phone ?? "").includes(q) || (d.email ?? "").toLowerCase().includes(q);
    });
  }, [overview.debtors, query, statusFilter]);

  const cards = [
    { label: "Total Outstanding", value: formatMoney(overview.totalOutstanding), icon: "💰", bg: "var(--accent-weak)" },
    { label: "Total Paid", value: formatMoney(overview.totalPaid), icon: "✅", bg: "var(--green-weak)" },
    { label: "Overdue Amount", value: formatMoney(overview.overdueAmount), icon: "⚠️", bg: "var(--red-weak)" },
    { label: "Number of Debtors", value: String(overview.debtorCount), icon: "👥", bg: "var(--sky-weak)" },
  ];

  async function openDetail(id: string) {
    const d = await fetchDebtorDetail(id);
    if (d) setDetail(d);
  }

  async function handleDelete(debtor: DebtorRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${debtor.customerName}"? This can't be undone.`)) return;
    setBusyId(debtor.id);
    try {
      await deleteDebtor(debtor.id);
      flash("Debtor deleted");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the debtor.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Debtors</div>
          <div className="mt-[3px] text-text-2">Track customer balances and payment history.</div>
        </div>
        <button
          onClick={() => setModalDebtor(null)}
          className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New debtor
        </button>
      </div>

      <div className="mb-[18px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-[13px] border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: c.bg }}>
                {c.icon}
              </span>
              <span className="text-[12px] font-semibold text-text-2">{c.label}</span>
            </div>
            <div className="font-mono text-[20px] font-bold tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, email…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text-2"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Customer</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Amount owed</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Due date</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Status</th>
                <th className="px-4 py-[11px]" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} onClick={() => openDetail(d.id)} className="cursor-pointer border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="text-[13.5px] font-semibold">{d.customerName}</div>
                    <div className="text-[11.5px] text-muted">{d.phone ?? d.email ?? "—"}</div>
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13px] font-bold">{formatMoney(d.amountOwed)}</td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">{d.dueDate ? formatShortDate(d.dueDate) : "—"}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold"
                      style={STATUS_STYLE[d.status]}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalDebtor(d);
                        }}
                        className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
                      >
                        Edit
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => handleDelete(d, e)}
                          disabled={busyId === d.id}
                          className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted">
                    No debtors match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalDebtor !== undefined && <DebtorModal debtor={modalDebtor ?? undefined} onClose={() => setModalDebtor(undefined)} />}
      {detail && <DebtorDetailSlideOver debtor={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
