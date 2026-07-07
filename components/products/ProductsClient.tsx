"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Papa from "papaparse";
import { ProductDetailSlideOver } from "@/components/products/ProductDetailSlideOver";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchProductDetail,
  exportProductsCsv,
  importProductsCsv,
  lookupProductByCode,
  type ImportProductRow,
} from "@/lib/actions/products";
import type { ProductDetail, ProductListRow } from "@/lib/queries/products";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";

const AddProductModal = dynamic(() => import("@/components/products/AddProductModal").then((m) => m.AddProductModal));
const BarcodeScannerModal = dynamic(() =>
  import("@/components/products/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
);

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  in_stock: { color: "var(--green)", background: "var(--green-weak)" },
  low_stock: { color: "var(--amber)", background: "var(--amber-weak)" },
  out_of_stock: { color: "var(--red)", background: "var(--red-weak)" },
};
const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

const EXPORT_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "description",
  "brand",
  "category",
  "supplier",
  "warehouse",
  "unit",
  "cost_price",
  "sell_price",
  "reorder_level",
  "qty_on_hand",
  "expiry_date",
  "image_url",
] as const;

interface Option {
  id: string;
  name: string;
}

export function ProductsClient({
  products,
  categories,
  warehouses,
  suppliers,
}: {
  products: ProductListRow[];
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(() => searchParams.get("new") === "1");
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [importing, setImporting] = useState(false);
  // Instant local patch for a just-saved row so the table doesn't sit stale
  // for the round trip router.refresh() takes to re-fetch server props.
  // Cleared whenever fresh `products` props actually arrive — adjusted
  // during render (not an effect) per React's guidance for resetting state
  // when a prop changes.
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<ProductListRow>>>({});
  const [prevProducts, setPrevProducts] = useState(products);
  if (products !== prevProducts) {
    setPrevProducts(products);
    setRowOverrides({});
  }
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleProductUpdated(updated: ProductDetail) {
    setSelected(updated);
    setRowOverrides((prev) => ({
      ...prev,
      [updated.id]: {
        name: updated.name,
        sku: updated.sku,
        barcode: updated.barcode,
        brand: updated.brand,
        imageUrl: updated.imageUrl,
        price: updated.sell_price,
        qty: updated.qty_on_hand,
        category: updated.category,
      },
    }));
  }

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      fetchProductDetail(openId).then((d) => d && setSelected(d));
    }
  }, [searchParams]);

  function closeAdd() {
    setShowAdd(false);
    router.replace("/products");
  }
  function closeDetail() {
    setSelected(null);
    router.replace("/products");
  }
  async function openDetail(id: string) {
    const detail = await fetchProductDetail(id);
    if (detail) setSelected(detail);
  }

  const rows = useMemo(() => {
    if (Object.keys(rowOverrides).length === 0) return products;
    return products.map((p) => (rowOverrides[p.id] ? { ...p, ...rowOverrides[p.id] } : p));
  }, [products, rowOverrides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (q) {
        const matchesQuery =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (warehouseFilter && p.warehouseId !== warehouseFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [rows, query, categoryFilter, warehouseFilter, statusFilter]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = query.trim();
    if (!code) return;
    const matches = products.filter((p) => p.sku === code || p.barcode === code);
    if (matches.length === 1) {
      setQuery("");
      openDetail(matches[0].id);
    }
  }

  async function handleScanDetected(code: string) {
    setShowScanner(false);
    try {
      const detail = await lookupProductByCode(code);
      if (detail) {
        setSelected(detail);
      } else {
        flash(`No product found for code "${code}"`);
      }
    } catch {
      flash("Could not look up that code.");
    }
  }

  async function handleExport() {
    try {
      const rows = await exportProductsCsv();
      const csv = Papa.unparse({
        fields: [...EXPORT_COLUMNS],
        data: rows.map((r) => EXPORT_COLUMNS.map((col) => r[col] ?? "")),
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Export ready");
    } catch {
      flash("Could not export products.");
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = Papa.parse<ImportProductRow>(text, { header: true, skipEmptyLines: true });
      const result = await importProductsCsv(parsed.data);
      flash(
        `Import complete: ${result.created} created, ${result.updated} updated${result.failed ? `, ${result.failed} failed` : ""}`,
      );
      if (result.errors.length > 0) {
        console.error("[Inventra] CSV import errors:", result.errors);
      }
      router.refresh();
    } catch {
      flash("Could not import that CSV file.");
    } finally {
      setImporting(false);
    }
  }

  const categoryCount = new Set(products.map((p) => p.category).filter(Boolean)).size;
  const warehouseCount = warehouses.length;

  const columns: TableColumn<ProductListRow>[] = [
    {
      key: "product",
      header: "Product",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="flex items-center gap-[11px]">
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-accent-weak text-[17px]">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt={p.name} fill sizes="36px" className="object-cover" />
            ) : (
              p.emoji || "📦"
            )}
          </div>
          <div>
            <div className="text-[13.5px] font-semibold">{p.name}</div>
            <div className="text-[11.5px] text-muted">{p.brand ?? "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      sortable: true,
      sortValue: (p) => p.sku,
      render: (p) => <span className="font-mono text-[12.5px] text-text-2">{p.sku}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (p) => p.category ?? "",
      render: (p) => <span className="text-[13px] text-text-2">{p.category ?? "—"}</span>,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortable: true,
      sortValue: (p) => p.price,
      render: (p) => <span className="font-mono text-[13px] font-semibold">{formatMoney(p.price)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      sortable: true,
      sortValue: (p) => p.qty,
      render: (p) => <span className="font-mono text-[13px] font-bold">{p.qty}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (p) => p.status,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold" style={STATUS_STYLE[p.status]}>
          {STATUS_LABEL[p.status]}
        </span>
      ),
    },
    {
      key: "arrow",
      header: "",
      hideable: false,
      align: "right",
      render: () => <span className="text-faint">→</span>,
    },
  ];

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Products</div>
          <div className="mt-[3px] text-text-2">
            {products.length} SKUs across {categoryCount} categories · {warehouseCount} warehouses
          </div>
        </div>
        <div className="flex gap-2.5">
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <button
            onClick={() => setShowScanner(true)}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
          >
            📷 Scan
          </button>
          <button
            onClick={handleExport}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
          >
            ⤓ Export
          </button>
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover disabled:opacity-60"
          >
            {importing ? "Importing…" : "⤒ Import CSV"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            + New product
          </button>
        </div>
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[37px] min-w-[200px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by name, SKU, brand, or scan a barcode…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        onRowClick={(p) => openDetail(p.id)}
        pageSize={20}
        columnVisibility
        emptyState={<EmptyState compact icon="📦" title="No products match your search" description="Try adjusting your search or filters." />}
      />

      {showAdd && (
        <AddProductModal categories={categories} warehouses={warehouses} suppliers={suppliers} onClose={closeAdd} />
      )}
      {selected && (
        <ProductDetailSlideOver
          product={selected}
          categories={categories}
          warehouses={warehouses}
          suppliers={suppliers}
          onClose={closeDetail}
          onProductUpdated={handleProductUpdated}
        />
      )}
      {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
