"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  hideable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  search?: {
    placeholder?: string;
    filter: (row: T, query: string) => boolean;
  };
  selectable?: boolean;
  bulkActions?: (selected: T[], clearSelection: () => void) => React.ReactNode;
  pageSize?: number;
  columnVisibility?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

const ALIGN_CLASS: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  search,
  selectable = false,
  bulkActions,
  pageSize = 10,
  columnVisibility = false,
  emptyState,
  onRowClick,
}: TableProps<T>) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search || !debouncedQuery.trim()) return rows;
    return rows.filter((row) => search.filter(row, debouncedQuery.trim().toLowerCase()));
  }, [rows, debouncedQuery, search]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  function toggleSort(col: TableColumn<T>) {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: "asc" };
      if (prev.dir === "asc") return { key: col.key, dir: "desc" };
      return null;
    });
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllOnPage() {
    const pageKeys = paged.map(rowKey);
    const allSelected = pageKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(rowKey(r)));

  return (
    <div>
      {(search || columnVisibility) && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          {search && (
            <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={search.placeholder ?? "Search…"}
                aria-label={search.placeholder ?? "Search"}
                className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
              />
            </div>
          )}
          {columnVisibility && (
            <div className="relative">
              <button
                onClick={() => setColumnsMenuOpen((v) => !v)}
                aria-label="Toggle column visibility"
                aria-expanded={columnsMenuOpen}
                className="h-[37px] rounded-[9px] border border-border bg-surface px-3 text-[13px] font-semibold text-text-2 hover:bg-hover"
              >
                Columns
              </button>
              {columnsMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-10 w-[190px] rounded-[10px] border border-border bg-surface p-1.5 shadow-[var(--shadow)]">
                  {columns
                    .filter((c) => c.hideable !== false)
                    .map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-1.5 text-[12.5px] hover:bg-hover"
                      >
                        <input
                          type="checkbox"
                          checked={!hidden.has(c.key)}
                          onChange={() =>
                            setHidden((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.key)) next.delete(c.key);
                              else next.add(c.key);
                              return next;
                            })
                          }
                        />
                        {c.header}
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectable && selectedRows.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-border bg-accent-weak px-3.5 py-2">
          <span className="text-[12.5px] font-semibold text-accent-text">
            {selectedRows.length} selected
          </span>
          <div className="flex flex-1 items-center gap-2">
            {bulkActions?.(selectedRows, () => setSelected(new Set()))}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[12.5px] font-semibold text-text-2 hover:text-text"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="sticky top-0 z-[1] bg-surface-2">
                {selectable && (
                  <th className="w-10 px-4 py-[11px]">
                    <input
                      type="checkbox"
                      aria-label="Select all rows on this page"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                    />
                  </th>
                )}
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c)}
                    className={`px-3.5 py-[11px] text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted first:pl-4 last:pr-4 ${ALIGN_CLASS[c.align ?? "left"]} ${c.sortable ? "cursor-pointer select-none hover:text-text-2" : ""}`}
                >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {c.sortable && sort?.key === c.key && (
                        <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={`border-t border-border-2 ${onRowClick ? "cursor-pointer hover:bg-hover" : ""}`}
                  >
                    {selectable && (
                      <td className="px-4 py-[11px]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selected.has(key)}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                    )}
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3.5 py-[11px] text-[13px] first:pl-4 last:pr-4 ${ALIGN_CLASS[c.align ?? "left"]}`}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                    className="px-4 py-10 text-center text-[13px] text-muted"
                  >
                    {emptyState ?? "No results found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border-2 px-4 py-3 text-[12.5px] text-muted">
          <span>
            Showing {paged.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {(currentPage - 1) * pageSize + paged.length} of {sorted.length}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-surface disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
              >
                ‹
              </button>
              <span className="font-mono">
                {currentPage} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                aria-label="Next page"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-surface disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
