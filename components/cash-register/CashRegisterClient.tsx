"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { openCashRegister, updateCashRegisterOpening, closeCashRegister } from "@/lib/actions/cash-register";
import { exportToPdf, exportToExcel, type ExportColumn } from "@/lib/export";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CashRegisterRow, TodaysCashRegister } from "@/lib/queries/cash-register";

interface Props {
  branches: { id: string; name: string }[];
  branchId: string;
  today: TodaysCashRegister;
  history: CashRegisterRow[];
  isManager: boolean;
  isAdmin: boolean;
}

const HISTORY_COLUMNS: ExportColumn<CashRegisterRow>[] = [
  { key: "date", header: "Date", value: (r) => r.businessDate },
  { key: "branch", header: "Branch", value: (r) => r.warehouseName },
  { key: "opening", header: "Opening", value: (r) => r.openingBalance },
  { key: "sales", header: "Cash Sales", value: (r) => r.cashSales ?? 0 },
  { key: "expenses", header: "Expenses", value: (r) => r.cashExpenses },
  { key: "withdrawals", header: "Withdrawals", value: (r) => r.cashWithdrawals },
  { key: "expected", header: "Expected", value: (r) => r.expectedClosingBalance ?? 0 },
  { key: "actual", header: "Actual", value: (r) => r.actualCashCount ?? 0 },
  { key: "difference", header: "Difference", value: (r) => r.difference ?? 0 },
  { key: "closedBy", header: "Closed By", value: (r) => r.closedByName ?? "—" },
];

export function CashRegisterClient({ branches, branchId, today, history, isManager, isAdmin }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();

  const [openForm, setOpenForm] = useState({ moneyAtHand: "", moneyInPurse: "" });
  const [opening, setOpening] = useState(false);

  const [editingOpen, setEditingOpen] = useState(false);
  const [editForm, setEditForm] = useState({ moneyAtHand: "", moneyInPurse: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [closeForm, setCloseForm] = useState({ otherCashIncome: "0", cashExpenses: "0", cashWithdrawals: "0", actualCashCount: "", notes: "" });
  const [closing, setClosing] = useState(false);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  function switchBranch(id: string) {
    router.push(`${pathname}?branch=${id}`);
  }

  async function handleOpen() {
    const moneyAtHand = Number(openForm.moneyAtHand) || 0;
    const moneyInPurse = Number(openForm.moneyInPurse) || 0;
    setOpening(true);
    try {
      await openCashRegister({ warehouseId: branchId, moneyAtHand, moneyInPurse });
      flash("Cash register opened for today");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not open the cash register.");
    } finally {
      setOpening(false);
    }
  }

  function startEditOpening() {
    if (!today.register) return;
    setEditForm({ moneyAtHand: String(today.register.moneyAtHand), moneyInPurse: String(today.register.moneyInPurse) });
    setEditingOpen(true);
  }

  async function handleSaveEdit() {
    if (!today.register) return;
    setSavingEdit(true);
    try {
      await updateCashRegisterOpening(today.register.id, {
        moneyAtHand: Number(editForm.moneyAtHand) || 0,
        moneyInPurse: Number(editForm.moneyInPurse) || 0,
      });
      flash("Opening balance updated");
      setEditingOpen(false);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not update the opening balance.");
    } finally {
      setSavingEdit(false);
    }
  }

  const liveExpected = useMemo(() => {
    if (!today.register) return 0;
    const otherIncome = Number(closeForm.otherCashIncome) || 0;
    const expenses = Number(closeForm.cashExpenses) || 0;
    const withdrawals = Number(closeForm.cashWithdrawals) || 0;
    return today.register.openingBalance + today.cashSalesSoFar + otherIncome - expenses - withdrawals;
  }, [today, closeForm.otherCashIncome, closeForm.cashExpenses, closeForm.cashWithdrawals]);

  async function handleClose() {
    if (!today.register) return;
    if (!closeForm.actualCashCount) {
      flash("Enter the actual cash count first.");
      return;
    }
    setClosing(true);
    try {
      await closeCashRegister(today.register.id, {
        otherCashIncome: Number(closeForm.otherCashIncome) || 0,
        cashExpenses: Number(closeForm.cashExpenses) || 0,
        cashWithdrawals: Number(closeForm.cashWithdrawals) || 0,
        actualCashCount: Number(closeForm.actualCashCount) || 0,
        notes: closeForm.notes,
      });
      flash("Business day closed");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not close the cash register.");
    } finally {
      setClosing(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((r) => {
      if (r.businessDate < from || r.businessDate > to) return false;
      if (!q) return true;
      return r.businessDate.includes(q) || (r.closedByName ?? "").toLowerCase().includes(q);
    });
  }, [history, search, from, to]);

  const columns: TableColumn<CashRegisterRow>[] = useMemo(
    () => [
      { key: "date", header: "Date", sortable: true, sortValue: (r) => r.businessDate, render: (r) => <span className="text-[12.5px] font-semibold">{r.businessDate}</span> },
      { key: "opening", header: "Opening", align: "right", render: (r) => <span className="font-mono text-[12.5px]">{formatMoney(r.openingBalance)}</span> },
      { key: "sales", header: "Cash Sales", align: "right", render: (r) => <span className="font-mono text-[12.5px]">{formatMoney(r.cashSales ?? 0)}</span> },
      { key: "expected", header: "Expected", align: "right", render: (r) => <span className="font-mono text-[12.5px]">{r.expectedClosingBalance !== null ? formatMoney(r.expectedClosingBalance) : "—"}</span> },
      { key: "actual", header: "Actual", align: "right", render: (r) => <span className="font-mono text-[12.5px]">{r.actualCashCount !== null ? formatMoney(r.actualCashCount) : "—"}</span> },
      {
        key: "difference",
        header: "Difference",
        align: "right",
        render: (r) =>
          r.difference === null ? (
            <span className="text-[12.5px] text-muted">—</span>
          ) : (
            <span className={`font-mono text-[12.5px] font-bold ${r.difference === 0 ? "text-green" : "text-red"}`}>{formatMoney(r.difference)}</span>
          ),
      },
      { key: "closedBy", header: "Closed by", render: (r) => <span className="text-[12.5px] text-text-2">{r.closedByName ?? "—"}</span> },
    ],
    [formatMoney],
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Cash Register</div>
          <div className="mt-[3px] text-text-2">Opening float, live cash position, and end-of-day reconciliation.</div>
        </div>
        {branches.length > 1 && (
          <select
            value={branchId}
            onChange={(e) => switchBranch(e.target.value)}
            aria-label="Branch"
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!today.register ? (
        isManager ? (
          <div className="mb-[18px] max-w-md rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
            <div className="mb-3.5 text-[15px] font-bold">Open business day</div>
            <div className="mb-2.5">
              <label className="mb-1 block text-[12px] font-semibold text-text-2">Money at hand</label>
              <input
                type="number"
                min={0}
                value={openForm.moneyAtHand}
                onChange={(e) => setOpenForm((f) => ({ ...f, moneyAtHand: e.target.value }))}
                className="h-[37px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text"
                placeholder="0"
              />
            </div>
            <div className="mb-3.5">
              <label className="mb-1 block text-[12px] font-semibold text-text-2">Money in purse / drawer</label>
              <input
                type="number"
                min={0}
                value={openForm.moneyInPurse}
                onChange={(e) => setOpenForm((f) => ({ ...f, moneyInPurse: e.target.value }))}
                className="h-[37px] w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text"
                placeholder="0"
              />
            </div>
            <div className="mb-3.5 text-[12.5px] text-muted">
              Opening balance: <span className="font-mono font-bold text-text">{formatMoney((Number(openForm.moneyAtHand) || 0) + (Number(openForm.moneyInPurse) || 0))}</span>
            </div>
            <button
              onClick={handleOpen}
              disabled={opening}
              className="h-[37px] w-full rounded-[9px] bg-accent text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {opening ? "Opening…" : "Open business day"}
            </button>
          </div>
        ) : (
          <EmptyState icon="🔴" title="Business day not opened yet" description="Ask a manager or admin to open the cash register for today." />
        )
      ) : (
        <div className="mb-[18px] rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-[9px] w-[9px] rounded-full ${today.register.status === "open" ? "bg-green" : "bg-muted"}`} />
              <span className="text-[15px] font-bold">{today.register.status === "open" ? "Business day open" : "Business day closed"}</span>
            </div>
            {isAdmin && today.register.status === "open" && !editingOpen && (
              <button onClick={startEditOpening} className="text-[12.5px] font-semibold text-accent-text">
                Edit opening balance
              </button>
            )}
          </div>

          {editingOpen ? (
            <div className="mb-3.5 flex flex-wrap items-end gap-2.5">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-text-2">Money at hand</label>
                <input
                  type="number"
                  value={editForm.moneyAtHand}
                  onChange={(e) => setEditForm((f) => ({ ...f, moneyAtHand: e.target.value }))}
                  className="h-[35px] w-32 rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-text-2">Money in purse</label>
                <input
                  type="number"
                  value={editForm.moneyInPurse}
                  onChange={(e) => setEditForm((f) => ({ ...f, moneyInPurse: e.target.value }))}
                  className="h-[35px] w-32 rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                />
              </div>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="h-[35px] rounded-[8px] bg-accent px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-60">
                {savingEdit ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingOpen(false)} className="h-[35px] rounded-[8px] border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text">
                Cancel
              </button>
            </div>
          ) : (
            <div className="mb-3.5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
              <div>
                <div className="text-[11px] text-muted">Opening balance</div>
                <div className="font-mono text-[17px] font-bold">{formatMoney(today.register.openingBalance)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">Cash sales {today.register.status === "open" ? "so far" : ""}</div>
                <div className="font-mono text-[17px] font-bold">{formatMoney(today.register.status === "open" ? today.cashSalesSoFar : today.register.cashSales ?? 0)}</div>
              </div>
              {today.register.status === "open" && (
                <div>
                  <div className="text-[11px] text-muted">Total sales so far</div>
                  <div className="font-mono text-[17px] font-bold">{formatMoney(today.totalSalesSoFar)}</div>
                </div>
              )}
              {today.register.status === "closed" && (
                <>
                  <div>
                    <div className="text-[11px] text-muted">Expected closing</div>
                    <div className="font-mono text-[17px] font-bold">{formatMoney(today.register.expectedClosingBalance ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted">Actual count</div>
                    <div className="font-mono text-[17px] font-bold">{formatMoney(today.register.actualCashCount ?? 0)}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {today.register.status === "closed" && today.register.difference !== null && (
            <div
              className={`mb-3.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold ${
                today.register.difference === 0 ? "bg-green-weak text-green" : "bg-red-weak text-red"
              }`}
            >
              {today.register.difference === 0
                ? "✅ Cash balanced"
                : `⚠ ${today.register.difference > 0 ? "Overage" : "Shortage"} of ${formatMoney(Math.abs(today.register.difference))}`}
            </div>
          )}

          {isManager && today.register.status === "open" && (
            <div className="border-t border-border pt-3.5">
              <div className="mb-2.5 text-[13px] font-bold">Close business day</div>
              <div className="mb-2.5 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-text-2">Other cash income</label>
                  <input
                    type="number"
                    value={closeForm.otherCashIncome}
                    onChange={(e) => setCloseForm((f) => ({ ...f, otherCashIncome: e.target.value }))}
                    className="h-[35px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-text-2">Cash expenses</label>
                  <input
                    type="number"
                    value={closeForm.cashExpenses}
                    onChange={(e) => setCloseForm((f) => ({ ...f, cashExpenses: e.target.value }))}
                    className="h-[35px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-text-2">Cash withdrawals</label>
                  <input
                    type="number"
                    value={closeForm.cashWithdrawals}
                    onChange={(e) => setCloseForm((f) => ({ ...f, cashWithdrawals: e.target.value }))}
                    className="h-[35px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-text-2">Actual cash count</label>
                  <input
                    type="number"
                    value={closeForm.actualCashCount}
                    onChange={(e) => setCloseForm((f) => ({ ...f, actualCashCount: e.target.value }))}
                    className="h-[35px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                    placeholder="Count the drawer"
                  />
                </div>
              </div>
              <div className="mb-2.5">
                <label className="mb-1 block text-[12px] font-semibold text-text-2">Notes (optional)</label>
                <input
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
                  className="h-[35px] w-full rounded-[8px] border border-border bg-surface px-2.5 text-[13px] text-text"
                />
              </div>
              <div className="mb-3 text-[12.5px] text-muted">
                Expected closing balance: <span className="font-mono font-bold text-text">{formatMoney(liveExpected)}</span>
              </div>
              <button onClick={handleClose} disabled={closing} className="h-[37px] rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                {closing ? "Closing…" : "Close business day"}
              </button>
            </div>
          )}
        </div>
      )}

      {isManager && (
        <>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[15px] font-bold">History</div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[35px] rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text" />
              <span className="text-muted">–</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-[35px] rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-[35px] w-36 rounded-[8px] border border-border bg-surface px-2.5 text-[12.5px] text-text"
              />
              <button
                onClick={() => exportToPdf("Cash Register History", filteredHistory, HISTORY_COLUMNS, "cash-register-history.pdf")}
                className="h-[35px] rounded-[8px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
              >
                Export PDF
              </button>
              <button
                onClick={() => exportToExcel(filteredHistory, HISTORY_COLUMNS, "cash-register-history.xlsx", "History")}
                className="h-[35px] rounded-[8px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
              >
                Export Excel
              </button>
            </div>
          </div>
          <Table
            columns={columns}
            rows={filteredHistory}
            rowKey={(r) => r.id}
            pageSize={20}
            emptyState={<EmptyState compact icon="🗓️" title="No history yet" description="Closed business days will show up here." />}
          />
        </>
      )}
    </div>
  );
}
