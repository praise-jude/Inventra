"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { deleteSupplier, fetchSupplierDetail } from "@/lib/actions/suppliers";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

const SupplierModal = dynamic(() => import("@/components/suppliers/SupplierModal").then((m) => m.SupplierModal));
const SupplierDetailSlideOver = dynamic(() =>
  import("@/components/suppliers/SupplierDetailSlideOver").then((m) => m.SupplierDetailSlideOver),
);
import type { SupplierRow, SupplierDetail } from "@/lib/queries/suppliers";

interface SuppliersFiltersState {
  q: string;
}

export function SuppliersClient({
  rows,
  total,
  page,
  pageSize,
  canManage,
  filters,
}: {
  rows: SupplierRow[];
  total: number;
  page: number;
  pageSize: number;
  canManage: boolean;
  filters: SuppliersFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const flash = useToast();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalSupplier, setModalSupplier] = useState<SupplierRow | null | undefined>(undefined);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  function pushParams(next: Partial<SuppliersFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
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

  async function openDetail(id: string) {
    const d = await fetchSupplierDetail(id);
    if (d) setDetail(d);
  }

  const handleDelete = useCallback(
    async (supplier: SupplierRow, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`Delete "${supplier.name}"? This can't be undone.`)) return;
      setBusyId(supplier.id);
      try {
        await deleteSupplier(supplier.id);
        flash("Supplier deleted");
        router.refresh();
      } catch (err) {
        flash(err instanceof Error ? err.message : "Could not delete the supplier.");
      } finally {
        setBusyId(null);
      }
    },
    [flash, router],
  );

  async function handleBulkDelete(selected: SupplierRow[], clear: () => void) {
    if (!window.confirm(`Delete ${selected.length} supplier(s)? This can't be undone.`)) return;
    setBulkBusy(true);
    let failed = 0;
    for (const s of selected) {
      try {
        await deleteSupplier(s.id);
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clear();
    flash(failed ? `Deleted ${selected.length - failed}, ${failed} failed (still in use)` : `${selected.length} supplier(s) deleted`);
    router.refresh();
  }

  const columns: TableColumn<SupplierRow>[] = useMemo(() => [
    {
      key: "supplier",
      header: "Supplier",
      render: (s) => (
        <div>
          <div className="text-[13.5px] font-semibold">{s.name}</div>
          <div className="text-[11.5px] text-muted">{s.company ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => (
        <div className="text-[12.5px] text-text-2">
          <div>{s.contactPerson ?? "—"}</div>
          <div className="text-muted">{s.email ?? s.phone ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "products",
      header: "Products",
      align: "right",
      render: (s) => <span className="font-mono text-[13px] font-bold">{s.productCount}</span>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            render: (s: SupplierRow) => (
              <div className="flex justify-end gap-2">
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setModalSupplier(s);
                  }}
                  className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
                >
                  Edit
                </button>
                <button
                  onClick={(e: React.MouseEvent) => handleDelete(s, e)}
                  disabled={busyId === s.id}
                  className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]
      : []),
  ], [canManage, busyId, handleDelete]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setModalSupplier(null)}
            className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New supplier
          </button>
        )}
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => openDetail(s.id)}
        pageSize={Math.max(pageSize, rows.length)}
        selectable={canManage}
        bulkActions={
          canManage
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
        emptyState={<EmptyState compact icon="🚚" title="No suppliers match your search" description="Try a different search term." />}
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

      {modalSupplier !== undefined && (
        <SupplierModal supplier={modalSupplier ?? undefined} onClose={() => setModalSupplier(undefined)} />
      )}
      {detail && <SupplierDetailSlideOver supplier={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
