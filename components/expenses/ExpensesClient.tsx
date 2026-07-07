"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { deleteExpense } from "@/lib/actions/expenses";
import { ExpenseTrendChart } from "@/components/expenses/ExpenseTrendChart";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

const ExpenseModal = dynamic(() => import("@/components/expenses/ExpenseModal").then((m) => m.ExpenseModal));
import type { ExpensesOverview, ExpenseRow } from "@/lib/queries/expenses";

const CATEGORY_LABEL: Record<string, string> = {
  rent: "Rent",
  salary: "Salary",
  transport: "Transport",
  utilities: "Utilities",
  inventory_purchase: "Inventory Purchase",
  logistics: "Logistics",
  miscellaneous: "Miscellaneous",
};

export function ExpensesClient({ overview }: { overview: ExpensesOverview }) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalExpense, setModalExpense] = useState<ExpenseRow | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overview.expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (e.description ?? "").toLowerCase().includes(q) || CATEGORY_LABEL[e.category].toLowerCase().includes(q);
    });
  }, [overview.expenses, query, categoryFilter]);

  const cards = [
    { label: "Daily Expenses", value: formatMoney(overview.dailyTotal), icon: "📅", bg: "var(--amber-weak)" },
    { label: "Weekly Expenses", value: formatMoney(overview.weeklyTotal), icon: "🗓️", bg: "var(--sky-weak)" },
    { label: "Monthly Expenses", value: formatMoney(overview.monthlyTotal), icon: "📊", bg: "var(--accent-weak)" },
  ];

  async function handleDelete(expense: ExpenseRow) {
    if (!window.confirm("Delete this expense? This can't be undone.")) return;
    setBusyId(expense.id);
    try {
      await deleteExpense(expense.id);
      flash("Expense deleted");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the expense.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkDelete(rows: ExpenseRow[], clear: () => void) {
    if (!window.confirm(`Delete ${rows.length} expense(s)? This can't be undone.`)) return;
    setBulkBusy(true);
    let failed = 0;
    for (const e of rows) {
      try {
        await deleteExpense(e.id);
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clear();
    flash(failed ? `Deleted ${rows.length - failed}, ${failed} failed` : `${rows.length} expense(s) deleted`);
    router.refresh();
  }

  const columns: TableColumn<ExpenseRow>[] = [
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (e) => CATEGORY_LABEL[e.category],
      render: (e) => <span className="text-[13.5px] font-semibold">{CATEGORY_LABEL[e.category]}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (e) => <span className="text-[12.5px] text-text-2">{e.description ?? "—"}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (e) => e.incurredAt,
      render: (e) => <span className="text-[12.5px] text-text-2">{formatShortDate(e.incurredAt)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      sortValue: (e) => e.amount,
      render: (e) => <span className="font-mono text-[13px] font-bold">{formatMoney(e.amount)}</span>,
    },
    {
      key: "actions",
      header: "",
      hideable: false,
      align: "right",
      render: (e) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setModalExpense(e)}
            className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(e)}
            disabled={busyId === e.id}
            className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Expenses</div>
          <div className="mt-[3px] text-text-2">Track spending and its effect on profit.</div>
        </div>
        <button
          onClick={() => setModalExpense(null)}
          className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New expense
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

      <div className="mb-[18px] rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
        <div className="mb-1 text-[15px] font-bold">Expense trend</div>
        <div className="mb-1.5 text-[12.5px] text-muted">Last {overview.trend.length} days with recorded spend</div>
        <ExpenseTrendChart data={overview.trend.slice(-30)} />
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expenses…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text-2"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(e) => e.id}
        pageSize={20}
        selectable
        bulkActions={(selected, clear) => (
          <button
            onClick={() => handleBulkDelete(selected, clear)}
            disabled={bulkBusy}
            className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover disabled:opacity-60"
          >
            {bulkBusy ? "Deleting…" : "Delete selected"}
          </button>
        )}
        emptyState={<EmptyState compact icon="💸" title="No expenses match your search" description="Try adjusting your search or filters." />}
      />

      {modalExpense !== undefined && <ExpenseModal expense={modalExpense ?? undefined} onClose={() => setModalExpense(undefined)} />}
    </div>
  );
}
