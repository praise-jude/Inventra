"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { importProducts, type ImportProductRow, type ImportResult } from "@/lib/actions/products";
import { Button } from "@/components/ui/Button";

const TEMPLATE = `name,sku,unit,cost_price,sell_price,reorder_level,opening_qty,category,supplier,warehouse
Oat Milk 1L,MLK-002,each,1.10,2.29,80,140,Dairy,Meadowbrook Dairy,WH-1 · Downtown`;

// Minimal CSV line parser that understands quoted fields with commas/escaped quotes.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseCsv(text: string): ImportProductRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("The file needs a header row plus at least one product row.");
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);
  if (idx("name") === -1 || idx("sku") === -1) {
    throw new Error('The header row must include "name" and "sku" columns.');
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const cell = (name: string) => (idx(name) === -1 ? undefined : cells[idx(name)] || undefined);
    const num = (name: string) => {
      const v = cell(name);
      return v === undefined ? undefined : Number(v) || 0;
    };
    return {
      name: cell("name") ?? "",
      sku: cell("sku") ?? "",
      unit: cell("unit"),
      costPrice: num("cost_price"),
      sellPrice: num("sell_price"),
      reorderLevel: num("reorder_level"),
      openingQty: num("opening_qty"),
      category: cell("category"),
      supplier: cell("supplier"),
      warehouse: cell("warehouse"),
    };
  });
}

export function ImportCsvModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const parsed = parseCsv(await file.text());
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setRows([]);
      setFileName(null);
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await importProducts(rows);
      setResult(res);
      if (res.created > 0) {
        flash(`Imported ${res.created} product${res.created === 1 ? "" : "s"}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[480px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-bold">Import products from CSV</div>
            <div className="text-[12.5px] text-muted">
              Columns: name, sku, unit, cost_price, sell_price, reorder_level, opening_qty, category, supplier, warehouse.
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-7 text-center hover:border-accent"
          >
            <span className="text-[22px]">📄</span>
            <span className="text-[13.5px] font-semibold">{fileName ?? "Choose a .csv file"}</span>
            <span className="text-[12px] text-muted">
              {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? "" : "s"} ready to import` : "Only name and sku are required."}
            </span>
          </div>
          <button onClick={downloadTemplate} className="self-start text-[12.5px] font-semibold text-accent-text">
            ⤓ Download template
          </button>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
          {result && (
            <div className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 text-[12.5px]">
              <div className="font-semibold">
                {result.created} created · {result.skipped.length} skipped
              </div>
              {result.skipped.slice(0, 5).map((s) => (
                <div key={s.sku} className="mt-1 text-muted">
                  {s.sku}: {s.reason}
                </div>
              ))}
              {result.skipped.length > 5 && <div className="mt-1 text-muted">…and {result.skipped.length - 5} more</div>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button type="button" onClick={handleImport} disabled={rows.length === 0 || importing || result !== null}>
            {importing ? "Importing…" : `Import ${rows.length > 0 ? rows.length : ""} products`.replace("  ", " ")}
          </Button>
        </div>
      </div>
    </div>
  );
}
