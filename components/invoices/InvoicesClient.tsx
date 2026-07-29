"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { fetchInvoiceDetail } from "@/lib/actions/invoices";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import type { InvoicesOverview, InvoiceRow, InvoiceDetail, InvoiceProductOption } from "@/lib/queries/invoices";

const InvoiceModal = dynamic(() => import("@/components/invoices/InvoiceModal").then((m) => m.InvoiceModal));
const InvoiceDetailSlideOver = dynamic(() =>
  import("@/components/invoices/InvoiceDetailSlideOver").then((m) => m.InvoiceDetailSlideOver),
);

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  draft: { color: "var(--muted)", background: "var(--hover)" },
  sent: { color: "var(--sky)", background: "var(--sky-weak)" },
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  overdue: { color: "var(--red)", background: "var(--red-weak)" },
  void: { color: "var(--muted)", background: "var(--hover)" },
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

interface InvoicesFiltersState {
  q: string;
  status: string;
}

export function InvoicesClient({
  overview,
  products,
  orgName,
  canManage,
  page,
  pageSize,
  filters,
}: {
  overview: InvoicesOverview;
  products: InvoiceProductOption[];
  orgName: string;
  canManage: boolean;
  page: number;
  pageSize: number;
  filters: InvoicesFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);

  function pushParams(next: Partial<InvoicesFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status) params.set("status", merged.status);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search === filters.q) return;
    debounceRef.current = setTimeout(() => pushParams({ q: search }), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const cards = [
    { label: "Total Outstanding", value: formatMoney(overview.totalOutstanding), icon: "💰", bg: "var(--accent-weak)" },
    { label: "Total Paid", value: formatMoney(overview.totalPaid), icon: "✅", bg: "var(--green-weak)" },
    { label: "Overdue Invoices", value: String(overview.overdueCount), icon: "⚠️", bg: "var(--red-weak)" },
    { label: "Number of Invoices", value: String(overview.invoiceCount), icon: "📄", bg: "var(--sky-weak)" },
  ];

  async function openDetail(id: string) {
    try {
      const d = await fetchInvoiceDetail(id);
      if (d) setDetail(d);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not load the invoice.");
    }
  }

  const columns: TableColumn<InvoiceRow>[] = [
    {
      key: "customer",
      header: "Customer",
      render: (i) => (
        <div>
          <div className="text-[13.5px] font-semibold">{i.customerName}</div>
          <div className="font-mono text-[11.5px] text-muted">{i.invoiceNumber}</div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (i) => <span className="font-mono text-[13px] font-bold">{formatMoney(i.total)}</span>,
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (i) => <span className="text-[12.5px] text-text-2">{i.dueDate ? formatShortDate(i.dueDate) : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (i) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold"
          style={STATUS_STYLE[i.status]}
        >
          {STATUS_LABEL[i.status]}
        </span>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(overview.total / pageSize));

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Invoices</div>
          <div className="mt-[3px] text-text-2">Create and track customer invoices.</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + New invoice
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer or invoice number…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => pushParams({ status: e.target.value })}
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
        rows={overview.rows}
        rowKey={(i) => i.id}
        onRowClick={(i) => openDetail(i.id)}
        pageSize={Math.max(pageSize, overview.rows.length)}
        emptyState={<EmptyState compact icon="📄" title="No invoices match your search" description="Try adjusting your search or filters." />}
      />

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            Page {page} of {pageCount} · {overview.total} total
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => pushParams({ page: page - 1 })}
              disabled={page <= 1}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => pushParams({ page: page + 1 })}
              disabled={page >= pageCount}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {showCreate && <InvoiceModal products={products} onClose={() => setShowCreate(false)} />}
      {detail && <InvoiceDetailSlideOver invoice={detail} orgName={orgName} canManage={canManage} onClose={() => setDetail(null)} />}
    </div>
  );
}
