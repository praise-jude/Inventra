"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { deleteSupplier, fetchSupplierDetail } from "@/lib/actions/suppliers";
import { SupplierModal } from "@/components/suppliers/SupplierModal";
import { SupplierDetailSlideOver } from "@/components/suppliers/SupplierDetailSlideOver";
import type { SupplierRow, SupplierDetail } from "@/lib/queries/suppliers";

export function SuppliersClient({ suppliers, canManage }: { suppliers: SupplierRow[]; canManage: boolean }) {
  const router = useRouter();
  const flash = useToast();
  const [query, setQuery] = useState("");
  const [modalSupplier, setModalSupplier] = useState<SupplierRow | null | undefined>(undefined);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.company ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, query]);

  async function openDetail(id: string) {
    const d = await fetchSupplierDetail(id);
    if (d) setDetail(d);
  }

  async function handleDelete(supplier: SupplierRow, e: React.MouseEvent) {
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
  }

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Supplier</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Contact</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Products</th>
                {canManage && <th className="px-4 py-[11px]" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} onClick={() => openDetail(s.id)} className="cursor-pointer border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="text-[13.5px] font-semibold">{s.name}</div>
                    <div className="text-[11.5px] text-muted">{s.company ?? "—"}</div>
                  </td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">
                    <div>{s.contactPerson ?? "—"}</div>
                    <div className="text-muted">{s.email ?? s.phone ?? "—"}</div>
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13px] font-bold">{s.productCount}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalSupplier(s);
                          }}
                          className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(s, e)}
                          disabled={busyId === s.id}
                          className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-red hover:bg-hover"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-4 py-10 text-center text-[13px] text-muted">
                    No suppliers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalSupplier !== undefined && (
        <SupplierModal supplier={modalSupplier ?? undefined} onClose={() => setModalSupplier(undefined)} />
      )}
      {detail && <SupplierDetailSlideOver supplier={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
