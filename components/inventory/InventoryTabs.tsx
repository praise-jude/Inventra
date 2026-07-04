"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory/movements", label: "Stock movements" },
  { href: "/inventory/warehouses", label: "By warehouse" },
  { href: "/inventory/adjustments", label: "Adjustment log" },
  { href: "/inventory/categories", label: "Categories" },
  { href: "/inventory/suppliers", label: "Suppliers" },
];

export function InventoryTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-3.5 flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="-mb-px px-3.5 py-2.5 text-[13px]"
            style={{
              fontWeight: active ? 700 : 500,
              color: active ? "var(--text)" : "var(--muted)",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
