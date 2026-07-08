"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { deleteDebtor, fetchDebtorDetail, updateDebtorStatus } from "@/lib/actions/debtors";
import { DebtorDetailSlideOver } from "@/components/debtors/DebtorDetailSlideOver";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

const DebtorModal = dynamic(() => import("@/components/debtors/DebtorModal").then((m) => m.DebtorModal));
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
  partially_paid: "Half Payment",
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
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const handleStatusChange = useCallback(
    async (debtor: DebtorRow, status: string) => {
      setStatusBusyId(debtor.id);
      try {
        await updateDebtorStatus(debtor.id, status);
        flash("Status updated");
        router.refresh();
      } catch (err) {
        flash(err instanceof Error ? err.message : "Could not update the status.");
      } finally {
        setStatusBusyId(null);
      }
    },
    [flash, router],
  );

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

  const handleDelete = useCallback(
    async (debtor: DebtorRow, e: React.MouseEvent) => {
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
    },
    [flash, router],
  );

  async function handleBulkDelete(rows: DebtorRow[], clear: () => void) {
    if (!window.confirm(`Delete ${rows.length} debtor(s)? This can't be undone.`)) return;
    setBulkBusy(true);
    let failed = 0;
    for (const d of rows) {
      try {
        await deleteDebtor(d.id);
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clear();
    flash(failed ? `Deleted ${rows.length - failed}, ${failed} failed` : `${rows.length} debtor(s) deleted`);
    router.refresh();
  }

  const columns: TableColumn<DebtorRow>[] = useMemo(() => [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (d) => d.customerName,
      render: (d) => (
        <div>
          <div className="text-[13.5px] font-semibold">{d.customerName}</div>
          <div className="text-[11.5px] text-muted">{d.phone ?? d.email ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount owed",
      align: "right",
      sortable: true,
      sortValue: (d) => d.amountOwed,
      render: (d) => <span className="font-mono text-[13px] font-bold">{formatMoney(d.amountOwed)}</span>,
    },
    {
      key: "dueDate",
      header: "Due date",
      sortable: true,
      sortValue: (d) => d.dueDate ?? "",
      render: (d) => <span className="text-[12.5px] text-text-2">{d.dueDate ? formatShortDate(d.dueDate) : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (d) => d.status,
      render: (d) => (
        <select
          value={d.status}
          onChange={(e) => handleStatusChange(d, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={statusBusyId === d.id}
          className="h-7 rounded-[20px] border-none px-[9px] py-px text-[11.5px] font-bold outline-none disabled:opacity-60"
          style={STATUS_STYLE[d.status]}
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "actions",
      header: "",
      hideable: false,
      align: "right",
      render: (d) => (
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
      ),
    },
  ], [formatMoney, formatShortDate, statusBusyId, handleStatusChange, busyId, canDelete, handleDelete]);

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

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.id}
        onRowClick={(d) => openDetail(d.id)}
        pageSize={20}
        selectable={canDelete}
        bulkActions={
          canDelete
            ? (selected, clear) => (
                <button
                  onClick={() => handleBulkDelete(selected, clear)}
                  disabled={bulkBusy}
                  className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover disabled:opacity-60"
                >
                  {bulkBusy ? "Deleting…" : "Delete selected"}
                </button>
              )
            : undefined
        }
        emptyState={<EmptyState compact icon="💵" title="No debtors match your search" description="Try adjusting your search or filters." />}
      />

      {modalDebtor !== undefined && <DebtorModal debtor={modalDebtor ?? undefined} onClose={() => setModalDebtor(undefined)} />}
      {detail && <DebtorDetailSlideOver debtor={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
