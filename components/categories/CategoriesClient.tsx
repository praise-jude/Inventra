"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { deleteCategory } from "@/lib/actions/categories";
import type { CategoryRow } from "@/lib/queries/categories";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

const CategoryModal = dynamic(() => import("@/components/categories/CategoryModal").then((m) => m.CategoryModal));

export function CategoriesClient({ categories, canManage }: { categories: CategoryRow[]; canManage: boolean }) {
  const router = useRouter();
  const flash = useToast();
  const [query, setQuery] = useState("");
  const [modalCategory, setModalCategory] = useState<CategoryRow | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const handleDelete = useCallback(
    async (category: CategoryRow) => {
      if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
      setBusyId(category.id);
      try {
        await deleteCategory(category.id);
        flash("Category deleted");
        router.refresh();
      } catch (err) {
        flash(err instanceof Error ? err.message : "Could not delete the category.");
      } finally {
        setBusyId(null);
      }
    },
    [flash, router],
  );

  async function handleBulkDelete(rows: CategoryRow[], clear: () => void) {
    if (!window.confirm(`Delete ${rows.length} categor${rows.length === 1 ? "y" : "ies"}? This can't be undone.`)) return;
    setBulkBusy(true);
    let failed = 0;
    for (const c of rows) {
      try {
        await deleteCategory(c.id);
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clear();
    flash(failed ? `Deleted ${rows.length - failed}, ${failed} failed (still in use)` : `${rows.length} categor${rows.length === 1 ? "y" : "ies"} deleted`);
    router.refresh();
  }

  const columns: TableColumn<CategoryRow>[] = useMemo(() => [
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-[11px]">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-accent-weak text-[17px]">
            {c.emoji || "📦"}
          </div>
          <div className="text-[13.5px] font-semibold">{c.name}</div>
        </div>
      ),
    },
    {
      key: "products",
      header: "Products",
      align: "right",
      sortable: true,
      sortValue: (c) => c.productCount,
      render: (c) => <span className="font-mono text-[13px] font-bold">{c.productCount}</span>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            render: (c: CategoryRow) => (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModalCategory(c)}
                  className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  disabled={busyId === c.id}
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

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setModalCategory(null)}
            className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New category
          </button>
        )}
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        pageSize={20}
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
        emptyState={<EmptyState compact icon="🗂️" title="No categories match your search" description="Try a different search term." />}
      />

      {modalCategory !== undefined && (
        <CategoryModal category={modalCategory ?? undefined} onClose={() => setModalCategory(undefined)} />
      )}
    </div>
  );
}
