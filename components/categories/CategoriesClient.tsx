"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/app/ToastProvider";
import { deleteCategory } from "@/lib/actions/categories";
import type { CategoryRow } from "@/lib/queries/categories";

const CategoryModal = dynamic(() => import("@/components/categories/CategoryModal").then((m) => m.CategoryModal));

export function CategoriesClient({ categories, canManage }: { categories: CategoryRow[]; canManage: boolean }) {
  const router = useRouter();
  const flash = useToast();
  const [query, setQuery] = useState("");
  const [modalCategory, setModalCategory] = useState<CategoryRow | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  async function handleDelete(category: CategoryRow) {
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
  }

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

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Category</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Products</th>
                {canManage && <th className="px-4 py-[11px]" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-[11px]">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-accent-weak text-[17px]">
                        {c.emoji || "📦"}
                      </div>
                      <div className="text-[13.5px] font-semibold">{c.name}</div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13px] font-bold">{c.productCount}</td>
                  {canManage && (
                    <td className="px-4 py-3">
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
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="px-4 py-10 text-center text-[13px] text-muted">
                    No categories match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalCategory !== undefined && (
        <CategoryModal category={modalCategory ?? undefined} onClose={() => setModalCategory(undefined)} />
      )}
    </div>
  );
}
