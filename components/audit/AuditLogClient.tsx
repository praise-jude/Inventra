"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Table, type TableColumn } from "@/components/ui/Table";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import type { AuditLogRow } from "@/lib/queries/audit";
import { fetchAuditLogExportRows } from "@/lib/actions/audit";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  warehouse: "Warehouse",
};

function formatValue(v: Record<string, unknown> | null): string {
  if (!v) return "—";
  return Object.entries(v)
    .map(([k, val]) => `${k}: ${val === null || val === undefined ? "—" : String(val)}`)
    .join(", ");
}

interface AuditLogFiltersState {
  q: string;
  module: string;
  from: string;
  to: string;
  branch: string;
}

export function AuditLogClient({
  rows,
  total,
  page,
  pageSize,
  modules,
  branches,
  filters,
}: {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  modules: string[];
  branches: { id: string; name: string }[];
  filters: AuditLogFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { formatDateTime } = useWorkspace();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Partial<AuditLogFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.module) params.set("module", merged.module);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.branch) params.set("branch", merged.branch);
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

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const columns: TableColumn<AuditLogRow>[] = [
    {
      key: "when",
      header: "Date & Time",
      render: (r) => <span className="font-mono text-[12px] text-muted">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: "user",
      header: "User",
      render: (r) => <span className="text-[13px] font-semibold">{r.actorName}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (r) => <span className="text-[12.5px] text-text-2">{ROLE_LABEL[r.actorRole] ?? r.actorRole}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <span className="text-[12.5px] font-semibold text-accent-text">{r.action}</span>,
    },
    {
      key: "module",
      header: "Module",
      render: (r) => <span className="text-[12.5px] text-text-2">{r.module}</span>,
    },
    {
      key: "entity",
      header: "Item Affected",
      render: (r) => <span className="text-[12.5px] text-text-2">{r.entityLabel ?? "—"}</span>,
    },
    {
      key: "diff",
      header: "Previous → New Value",
      render: (r) => (
        <span className="text-[11.5px] text-muted">
          {r.previousValue ? `${formatValue(r.previousValue)} → ` : ""}
          {formatValue(r.newValue)}
        </span>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (r) => <span className="text-[12.5px] text-text-2">{r.branchName ?? "—"}</span>,
    },
    {
      key: "ip",
      header: "IP Address",
      render: (r) => <span className="font-mono text-[11.5px] text-muted">{r.ipAddress ?? "—"}</span>,
    },
  ];

  const exportColumns = [
    { key: "createdAt", header: "Date & Time", value: (r: AuditLogRow) => formatDateTime(r.createdAt) },
    { key: "actorName", header: "User", value: (r: AuditLogRow) => r.actorName },
    { key: "actorRole", header: "Role", value: (r: AuditLogRow) => ROLE_LABEL[r.actorRole] ?? r.actorRole },
    { key: "action", header: "Action", value: (r: AuditLogRow) => r.action },
    { key: "module", header: "Module", value: (r: AuditLogRow) => r.module },
    { key: "entityLabel", header: "Item Affected", value: (r: AuditLogRow) => r.entityLabel ?? "" },
    { key: "previousValue", header: "Previous Value", value: (r: AuditLogRow) => formatValue(r.previousValue) },
    { key: "newValue", header: "New Value", value: (r: AuditLogRow) => formatValue(r.newValue) },
    { key: "branchName", header: "Branch", value: (r: AuditLogRow) => r.branchName ?? "" },
    { key: "ipAddress", header: "IP Address", value: (r: AuditLogRow) => r.ipAddress ?? "" },
  ];

  async function fetchExportRows() {
    return fetchAuditLogExportRows({
      search: filters.q || undefined,
      module: filters.module || undefined,
      dateFrom: filters.from || undefined,
      dateTo: filters.to || undefined,
      branchId: filters.branch || undefined,
    });
  }

  const [exportRows, setExportRows] = useState<AuditLogRow[] | null>(null);
  // The "load all filtered rows" export set is only valid for the filters it
  // was fetched under — reset it whenever the filters change so a stale,
  // differently-filtered dataset never gets exported under new filters.
  const filtersKey = JSON.stringify(filters);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setExportRows(null);
  }

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, action, item…"
            aria-label="Search audit log"
            className="h-[37px] min-w-[220px] rounded-[9px] border border-border bg-surface px-3 text-[13px] text-text outline-none"
          />
          <select
            value={filters.module}
            onChange={(e) => pushParams({ module: e.target.value })}
            aria-label="Filter by module"
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
          >
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filters.branch}
            onChange={(e) => pushParams({ branch: e.target.value })}
            aria-label="Filter by branch"
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <DateRangeFilter from={filters.from} to={filters.to} onChange={(from, to) => pushParams({ from, to })} />
        </div>
        <ExportMenu
          rows={exportRows ?? rows}
          columns={exportColumns}
          filenameBase="audit-log"
          pdfTitle="Audit Log"
          disabled={false}
        />
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        pageSize={Math.max(pageSize, rows.length)}
        emptyState={
          <EmptyState icon="🛡️" title="No audit activity" description="Actions taken across your workspace will show up here." />
        }
      />

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            Page {page} of {pageCount} · {total} total
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
      {!exportRows && total > rows.length && (
        <button
          type="button"
          onClick={() => fetchExportRows().then(setExportRows)}
          className="mt-2 text-[11.5px] font-medium text-accent-text underline"
        >
          Load all {total} filtered rows before exporting (currently exporting this page only)
        </button>
      )}
    </div>
  );
}
