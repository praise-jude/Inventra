"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddProductModal } from "@/components/products/AddProductModal";
import { ProductDetailSlideOver } from "@/components/products/ProductDetailSlideOver";
import { fetchProductDetail } from "@/lib/actions/products";
import type { ProductDetail, ProductListRow } from "@/lib/queries/products";
import { useCurrency } from "@/components/app/CurrencyProvider";

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
  const { format: formatMoney } = useCurrency();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(() => searchParams.get("new") === "1");
  const [selected, setSelected] = useState<ProductDetail | null>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const categoryCount = new Set(products.map((p) => p.category).filter(Boolean)).size;
  const warehouseCount = warehouses.length;

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
          <button className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover">
            ⤓ Export
          </button>
          <button className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover">
            ⤒ Import CSV
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
            placeholder="Search by name, SKU, brand…"
            className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
          />
        </div>
        <button className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-2 hover:bg-hover">
          Category ⌄
        </button>
        <button className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-2 hover:bg-hover">
          Warehouse ⌄
        </button>
        <button className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-2 hover:bg-hover">
          Status ⌄
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="sticky top-0 bg-surface-2">
                <th className="px-4 py-[11px] pl-4 text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">SKU</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Category</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Price</th>
                <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Stock</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Status</th>
                <th className="px-4 py-[11px]" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => openDetail(p.id)} className="cursor-pointer border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-[11px] pl-4">
                    <div className="flex items-center gap-[11px]">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-accent-weak text-[17px]">
                        {p.emoji || "📦"}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold">{p.name}</div>
                        <div className="text-[11.5px] text-muted">{p.brand ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-[11px] font-mono text-[12.5px] text-text-2">{p.sku}</td>
                  <td className="px-3.5 py-[11px] text-[13px] text-text-2">{p.category ?? "—"}</td>
                  <td className="px-3.5 py-[11px] text-right font-mono text-[13px] font-semibold">{formatMoney(p.price)}</td>
                  <td className="px-3.5 py-[11px] text-right font-mono text-[13px] font-bold">{p.qty}</td>
                  <td className="px-3.5 py-[11px]">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold"
                      style={STATUS_STYLE[p.status]}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-[11px] text-right text-faint">→</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border-2 px-4 py-3 text-[12.5px] text-muted">
          <span>Showing {filtered.length} of {products.length}</span>
        </div>
      </div>

      {showAdd && (
        <AddProductModal categories={categories} warehouses={warehouses} suppliers={suppliers} onClose={closeAdd} />
      )}
      {selected && <ProductDetailSlideOver product={selected} onClose={closeDetail} />}
    </div>
  );
}
