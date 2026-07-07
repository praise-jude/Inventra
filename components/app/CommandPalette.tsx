"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { searchProducts, type PaletteProductResult } from "@/lib/actions/search";

interface PaletteItem {
  title: string;
  sub: string;
  kind: string;
  icon: string;
  bg: string;
  go: () => void;
}

export function CommandPalette({
  onClose,
  onToggleTheme,
}: {
  onClose: () => void;
  onToggleTheme: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<PaletteProductResult[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setProducts([]);
        return;
      }
      const results = await searchProducts(query);
      setProducts(results);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const pages: PaletteItem[] = useMemo(
    () => [
      { title: "Dashboard", sub: "Overview", kind: "Page", icon: "▦", bg: "var(--accent-weak)", go: () => router.push("/dashboard") },
      { title: "Products", sub: "Catalog", kind: "Page", icon: "📦", bg: "var(--accent-weak)", go: () => router.push("/products") },
      { title: "Inventory", sub: "Stock & movements", kind: "Page", icon: "🗃️", bg: "var(--accent-weak)", go: () => router.push("/inventory") },
      { title: "Sales", sub: "Transactions", kind: "Page", icon: "🧾", bg: "var(--accent-weak)", go: () => router.push("/sales") },
      { title: "Purchases", sub: "Purchase orders", kind: "Page", icon: "🛒", bg: "var(--accent-weak)", go: () => router.push("/purchases") },
      { title: "Customers", sub: "Balances & payments", kind: "Page", icon: "💵", bg: "var(--accent-weak)", go: () => router.push("/debtors") },
      { title: "Suppliers", sub: "Vendors", kind: "Page", icon: "🚚", bg: "var(--accent-weak)", go: () => router.push("/inventory/suppliers") },
      { title: "Warehouses", sub: "Locations & transfers", kind: "Page", icon: "🏬", bg: "var(--accent-weak)", go: () => router.push("/inventory/warehouses") },
      { title: "Reports", sub: "Sales, inventory, P&L", kind: "Page", icon: "📈", bg: "var(--accent-weak)", go: () => router.push("/reports") },
      { title: "Expenses", sub: "Spending & trends", kind: "Page", icon: "💸", bg: "var(--accent-weak)", go: () => router.push("/expenses") },
      { title: "Team", sub: "Members & roles", kind: "Page", icon: "👥", bg: "var(--accent-weak)", go: () => router.push("/team") },
      { title: "Notifications", sub: "Alerts & activity", kind: "Page", icon: "🔔", bg: "var(--accent-weak)", go: () => router.push("/notifications") },
      { title: "Billing", sub: "Plan & invoices", kind: "Page", icon: "💳", bg: "var(--accent-weak)", go: () => router.push("/billing") },
      { title: "Settings", sub: "General, printing, integrations", kind: "Page", icon: "⚙️", bg: "var(--accent-weak)", go: () => router.push("/settings") },
      { title: "New product", sub: "Add to catalog", kind: "Action", icon: "＋", bg: "var(--green-weak)", go: () => router.push("/products?new=1") },
      { title: "New sale", sub: "Record a transaction", kind: "Action", icon: "＋", bg: "var(--green-weak)", go: () => router.push("/sales/new") },
      { title: "Toggle dark mode", sub: "Appearance", kind: "Action", icon: "◐", bg: "var(--sky-weak)", go: onToggleTheme },
    ],
    [router, onToggleTheme],
  );

  const q = query.toLowerCase();
  const filteredPages = q ? pages.filter((p) => (p.title + p.sub + p.kind).toLowerCase().includes(q)) : pages;
  const productItems: PaletteItem[] = products.map((p) => ({
    title: p.name,
    sub: `SKU · ${p.sku}`,
    kind: "Product",
    icon: p.emoji || "📦",
    bg: "var(--sky-weak)",
    go: () => router.push(`/products?open=${p.id}`),
  }));
  const results = [...productItems, ...filteredPages];

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[80] flex items-start justify-center bg-[rgba(15,20,32,.45)] pt-[12vh] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[560px] overflow-hidden rounded-[15px] border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-[17px] py-[15px]">
          <span className="text-[16px] text-muted">⌕</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, actions, pages…"
            className="flex-1 border-none bg-transparent text-[15px] text-text outline-none"
          />
          <span className="rounded-[5px] border border-border px-1.5 py-px font-mono text-[11px] text-faint">
            ESC
          </span>
        </div>
        <div className="scroll max-h-[340px] overflow-y-auto p-2">
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => {
                r.go();
                onClose();
              }}
              className="flex cursor-pointer items-center gap-3 rounded-[9px] px-[11px] py-[9px] hover:bg-hover"
            >
              <span
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] text-[14px]"
                style={{ background: r.bg }}
              >
                {r.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{r.title}</div>
                <div className="text-[11.5px] text-muted">{r.sub}</div>
              </div>
              <span className="text-[11px] text-faint">{r.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
