"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchProductDetail,
  exportProductsCsv,
  importProductsCsv,
  lookupProductByCode,
  type ImportProductRow,
} from "@/lib/actions/products";
import type { ProductDetail, ProductExportRow, ProductListRow } from "@/lib/queries/products";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { STOCK_STATUS_COLORS as STATUS_STYLE, STOCK_STATUS_LABELS as STATUS_LABEL } from "@/lib/stock-status";
import { exportToCsv } from "@/lib/export";
import { parseSmartQuery } from "@/lib/smart-query";

const AddProductModal = dynamic(() => import("@/components/products/AddProductModal").then((m) => m.AddProductModal));
const BarcodeScannerModal = dynamic(() =>
  import("@/components/products/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
);
const ProductDetailSlideOver = dynamic(() =>
  import("@/components/products/ProductDetailSlideOver").then((m) => m.ProductDetailSlideOver),
);

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

interface ProductsFiltersState {
  q: string;
  category: string;
  warehouse: string;
  supplier: string;
  status: string;
  active: string;
  minPrice: string;
  maxPrice: string;
  minMargin: string;
  maxMargin: string;
  expiryFrom: string;
  expiryTo: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_ADVANCED_FILTERS = {
  minPrice: "",
  maxPrice: "",
  minMargin: "",
  maxMargin: "",
  expiryFrom: "",
  expiryTo: "",
  createdFrom: "",
  createdTo: "",
} as const;

export function ProductsClient({
  rows: products,
  total,
  page,
  pageSize,
  categories,
  warehouses,
  suppliers,
  filters,
}: {
  rows: ProductListRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: Option[];
  warehouses: Option[];
  suppliers: Option[];
  filters: ProductsFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flash = useToast();
  const { format: formatMoney } = useWorkspace();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [advancedDraft, setAdvancedDraft] = useState({
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minMargin: filters.minMargin,
    maxMargin: filters.maxMargin,
    expiryFrom: filters.expiryFrom,
    expiryTo: filters.expiryTo,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
  });
  const advancedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function pushParams(next: Partial<ProductsFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.warehouse) params.set("warehouse", merged.warehouse);
    if (merged.supplier) params.set("supplier", merged.supplier);
    if (merged.status) params.set("status", merged.status);
    if (merged.active) params.set("active", merged.active);
    if (merged.minPrice) params.set("minPrice", merged.minPrice);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if (merged.minMargin) params.set("minMargin", merged.minMargin);
    if (merged.maxMargin) params.set("maxMargin", merged.maxMargin);
    if (merged.expiryFrom) params.set("expiryFrom", merged.expiryFrom);
    if (merged.expiryTo) params.set("expiryTo", merged.expiryTo);
    if (merged.createdFrom) params.set("createdFrom", merged.createdFrom);
    if (merged.createdTo) params.set("createdTo", merged.createdTo);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const advancedFiltersActive =
    !!filters.minPrice || !!filters.maxPrice || !!filters.minMargin || !!filters.maxMargin || !!filters.expiryFrom || !!filters.expiryTo || !!filters.createdFrom || !!filters.createdTo;
  const [showAdvanced, setShowAdvanced] = useState(advancedFiltersActive);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search === filters.q) return;
    debounceRef.current = setTimeout(() => {
      // A handful of common phrases ("low stock", "above 50000", "expired
      // items"...) map straight to an existing filter instead of being
      // searched for as literal text — see lib/smart-query.ts for the
      // fixed pattern list this recognizes.
      const smart = parseSmartQuery(search);
      if (smart.matched) {
        setShowAdvanced(true);
        const next: Partial<ProductsFiltersState> = { q: "" };
        if (smart.filters.status) next.status = smart.filters.status;
        if (smart.filters.active) next.active = smart.filters.active;
        if (smart.filters.minPrice !== undefined) next.minPrice = String(smart.filters.minPrice);
        if (smart.filters.maxPrice !== undefined) next.maxPrice = String(smart.filters.maxPrice);
        if (smart.filters.expiryTo) next.expiryTo = smart.filters.expiryTo;
        setAdvancedDraft((d) => ({ ...d, ...next }));
        setSearch("");
        pushParams(next);
        return;
      }
      pushParams({ q: search });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Same debounce-then-navigate pattern as search above — these were
  // previously bound straight to the server-provided `filters.X` prop,
  // which visibly reverted to its stale value on every keystroke while the
  // router.push round trip was in flight (confirmed live: typing into the
  // price filter showed the input going blank mid-type).
  useEffect(() => {
    if (advancedDebounceRef.current) clearTimeout(advancedDebounceRef.current);
    const unchanged =
      advancedDraft.minPrice === filters.minPrice &&
      advancedDraft.maxPrice === filters.maxPrice &&
      advancedDraft.minMargin === filters.minMargin &&
      advancedDraft.maxMargin === filters.maxMargin &&
      advancedDraft.expiryFrom === filters.expiryFrom &&
      advancedDraft.expiryTo === filters.expiryTo &&
      advancedDraft.createdFrom === filters.createdFrom &&
      advancedDraft.createdTo === filters.createdTo;
    if (unchanged) return;
    advancedDebounceRef.current = setTimeout(() => pushParams({ ...advancedDraft }), 400);
    return () => {
      if (advancedDebounceRef.current) clearTimeout(advancedDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedDraft]);

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
        isActive: updated.isActive,
      },
    }));
  }

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      fetchProductDetail(openId).then((d) => d && setSelected(d));
    }
    // Deliberately re-runs whenever the `open` param changes (e.g. a
    // Command Palette or notification link to /products?open=<id> while
    // already on this route, which doesn't remount the component) — only
    // the `open` value itself matters, not the other filter params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("open")]);

  // Preserves the current search/filter/page params when closing a modal —
  // clearing the whole query string here would silently drop the user's
  // filters and bounce them back to an unfiltered page 1.
  function currentParamsString() {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.warehouse) params.set("warehouse", filters.warehouse);
    if (filters.status) params.set("status", filters.status);
    if (filters.active) params.set("active", filters.active);
    const page = searchParams.get("page");
    if (page && page !== "1") params.set("page", page);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function closeAdd() {
    setShowAdd(false);
    router.replace(currentParamsString());
  }
  function closeDetail() {
    setSelected(null);
    router.replace(currentParamsString());
  }
  async function openDetail(id: string) {
    const detail = await fetchProductDetail(id);
    if (detail) setSelected(detail);
  }

  const rows = useMemo(() => {
    if (Object.keys(rowOverrides).length === 0) return products;
    return products.map((p) => (rowOverrides[p.id] ? { ...p, ...rowOverrides[p.id] } : p));
  }, [products, rowOverrides]);

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = search.trim();
    if (!code) return;
    const detail = await lookupProductByCode(code);
    if (detail) {
      setSearch("");
      setSelected(detail);
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
      const exportRows = await exportProductsCsv();
      const columns = EXPORT_COLUMNS.map((col) => ({
        key: col,
        header: col,
        value: (r: ProductExportRow) => r[col] ?? "",
      }));
      await exportToCsv(exportRows, columns, `products-${new Date().toISOString().slice(0, 10)}.csv`);
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
      const Papa = (await import("papaparse")).default;
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

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const columns: TableColumn<ProductListRow>[] = useMemo(() => [
    {
      key: "product",
      header: "Product",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className={`flex items-center gap-[11px] ${p.isActive ? "" : "opacity-60"}`}>
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-accent-weak text-[17px]">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt={p.name} fill sizes="36px" className="object-cover" />
            ) : (
              p.emoji || "📦"
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              {p.name}
              {!p.isActive && <span className="rounded-[20px] bg-red-weak px-[7px] py-px text-[10px] font-bold text-red">Inactive</span>}
            </div>
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
  ], [formatMoney]);

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Products</div>
          <div className="mt-[3px] text-text-2">
            {total} SKUs across {categories.length} categories · {warehouses.length} warehouses
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by name, SKU, brand, or scan a barcode…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <select
          value={filters.category}
          onChange={(e) => pushParams({ category: e.target.value })}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.warehouse}
          onChange={(e) => pushParams({ warehouse: e.target.value })}
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
          value={filters.status}
          onChange={(e) => pushParams({ status: e.target.value })}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        <select
          value={filters.active}
          onChange={(e) => pushParams({ active: e.target.value })}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">Active & Inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          value={filters.supplier}
          onChange={(e) => pushParams({ supplier: e.target.value })}
          className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-text-2 hover:bg-hover"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`h-[37px] rounded-[9px] border px-3 text-[13px] font-semibold ${
            advancedFiltersActive ? "border-accent bg-accent-weak text-accent-text" : "border-border bg-surface text-text-2 hover:bg-hover"
          }`}
        >
          {showAdvanced ? "▴" : "▾"} More filters{advancedFiltersActive ? " •" : ""}
        </button>
      </div>

      {showAdvanced && (
        <div className="mb-3.5 flex flex-wrap items-end gap-3 rounded-[9px] border border-border bg-surface-2 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">Price range</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={advancedDraft.minPrice}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, minPrice: e.target.value }))}
                placeholder="Min"
                className="h-[33px] w-[90px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <span className="text-muted">–</span>
              <input
                type="number"
                value={advancedDraft.maxPrice}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, maxPrice: e.target.value }))}
                placeholder="Max"
                className="h-[33px] w-[90px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">Margin %</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={advancedDraft.minMargin}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, minMargin: e.target.value }))}
                placeholder="Min"
                className="h-[33px] w-[80px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <span className="text-muted">–</span>
              <input
                type="number"
                value={advancedDraft.maxMargin}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, maxMargin: e.target.value }))}
                placeholder="Max"
                className="h-[33px] w-[80px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">Expiry date</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={advancedDraft.expiryFrom}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, expiryFrom: e.target.value }))}
                className="h-[33px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <span className="text-muted">–</span>
              <input
                type="date"
                value={advancedDraft.expiryTo}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, expiryTo: e.target.value }))}
                className="h-[33px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted">Date added</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={advancedDraft.createdFrom}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, createdFrom: e.target.value }))}
                className="h-[33px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
              <span className="text-muted">–</span>
              <input
                type="date"
                value={advancedDraft.createdTo}
                onChange={(e) => setAdvancedDraft((d) => ({ ...d, createdTo: e.target.value }))}
                className="h-[33px] rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-text outline-none"
              />
            </div>
          </div>
          {advancedFiltersActive && (
            <button
              onClick={() => {
                setAdvancedDraft({ ...EMPTY_ADVANCED_FILTERS });
                pushParams({ ...EMPTY_ADVANCED_FILTERS });
              }}
              className="h-[33px] rounded-[7px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text-2 hover:bg-hover"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <Table
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => openDetail(p.id)}
        pageSize={Math.max(pageSize, rows.length)}
        columnVisibility
        emptyState={<EmptyState compact icon="📦" title="No products match your search" description="Try adjusting your search or filters." />}
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
