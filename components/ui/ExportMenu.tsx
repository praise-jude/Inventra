"use client";

import { useState } from "react";
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export";

interface ExportMenuProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filenameBase: string;
  pdfTitle: string;
  disabled?: boolean;
}

export function ExportMenu<T>({ rows, columns, filenameBase, pdfTitle, disabled }: ExportMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy || rows.length === 0}
        aria-expanded={open}
        className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-2 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
      >
        {busy ? "Exporting…" : "Export ▾"}
      </button>
      {open && !busy && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-10 w-[160px] rounded-[10px] border border-border bg-surface p-1.5 shadow-[var(--shadow)]">
          <button
            type="button"
            onClick={() => run(() => exportToCsv(rows, columns, `${filenameBase}-${stamp}.csv`))}
            className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium text-text hover:bg-hover"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => run(() => exportToExcel(rows, columns, `${filenameBase}-${stamp}.xlsx`))}
            className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium text-text hover:bg-hover"
          >
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => run(() => exportToPdf(pdfTitle, rows, columns, `${filenameBase}-${stamp}.pdf`))}
            className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium text-text hover:bg-hover"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
