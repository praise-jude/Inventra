"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isAdminRole, isManagerRole } from "@/lib/roles";

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/inventory", label: "Inventory", icon: "🗃️" },
  { href: "/sales", label: "Sales", icon: "🧾", hideForWarehouse: true },
  { href: "/debtors", label: "Customers", icon: "💵", managerOnly: true },
  { href: "/inventory/suppliers", label: "Suppliers", icon: "🚚" },
  { href: "/inventory/warehouses", label: "Warehouses", icon: "🏬" },
  { href: "/reports", label: "Reports", icon: "📈", managerOnly: true },
  { href: "/audit-log", label: "Audit Log", icon: "🛡️", adminOnly: true },
  { href: "/expenses", label: "Expenses", icon: "💸", managerOnly: true },
  { href: "/team", label: "Team", icon: "👥", adminOnly: true },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/billing", label: "Billing", icon: "💳", adminOnly: true },
  { href: "/settings", label: "Settings", icon: "⚙️", adminOnly: true },
];

export function Sidebar({
  orgName,
  plan,
  trialStatus,
  trialEndsAt,
  inventoryBadge,
  role,
  open,
  onNavigate,
}: {
  orgName: string;
  plan: string;
  trialStatus: string | null;
  trialEndsAt: string | null;
  inventoryBadge: number;
  role: string;
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = isAdminRole(role);
  const isManagerUp = isManagerRole(role);
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => !prev);
  }

  const nav = NAV.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.managerOnly || isManagerUp) && (!item.hideForWarehouse || role !== "warehouse"),
  );
  const activeHref = [...nav].sort((a, b) => b.href.length - a.href.length).find((item) => pathname.startsWith(item.href))?.href;

  return (
    <aside
      className={`app-sidebar flex h-screen flex-shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ${open ? "open" : ""} ${collapsed ? "w-[72px]" : "w-[236px]"}`}
      style={{ position: "sticky", top: 0 }}
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Image src="/inventra-logo.svg" alt="" width={30} height={30} className="h-[30px] w-[30px] flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold tracking-tight">Inventra</div>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-[12px] text-muted hover:bg-hover hover:text-text min-[881px]:flex"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
        </button>
      </div>
      <div className="px-3 pb-2.5 pt-1">
        <button
          title={`${orgName} · ${plan} plan`}
          className={`flex w-full items-center gap-2.5 rounded-[9px] border border-border bg-surface-2 p-2 text-left hover:bg-hover ${collapsed ? "justify-center" : ""}`}
        >
          <div
            aria-hidden="true"
            className="h-6 w-6 flex-shrink-0 rounded-[6px]"
            style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}
          />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text">{orgName}</div>
                <div className="text-[11px] capitalize text-muted">{plan} plan</div>
              </div>
              <span aria-hidden="true" className="text-[11px] text-faint">⌄</span>
            </>
          )}
        </button>
      </div>
      <nav className="scroll flex-1 overflow-y-auto px-2.5 py-1">
        {nav.map((item) => {
          const active = item.href === activeHref;
          const badge = item.href === "/inventory" && inventoryBadge > 0 ? inventoryBadge : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`mb-0.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] hover:bg-hover ${collapsed ? "justify-center" : ""}`}
              style={{
                fontWeight: active ? 700 : 500,
                color: active ? "var(--accent-text)" : "var(--text-2)",
                background: active ? "var(--accent-weak)" : "transparent",
              }}
            >
              <span aria-hidden="true" className="w-[18px] text-center text-[15px]" style={{ filter: "grayscale(.2)" }}>
                {item.icon}
              </span>
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {badge !== null && !collapsed && (
                <span className="rounded-[20px] bg-amber-weak px-1.5 py-px font-mono text-[10.5px] font-bold text-amber">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (trialStatus === "past_due" || trialStatus === "suspended") && (
        <div className="border-t border-border p-2.5">
          <div className="rounded-[11px] border border-red bg-red-weak p-3">
            <div className="mb-0.5 text-[12.5px] font-bold text-red">
              {trialStatus === "past_due" ? "Payment failed" : "Subscription suspended"}
            </div>
            <div className="mb-2.5 text-[11.5px] leading-snug text-text-2">
              {trialStatus === "past_due"
                ? "We couldn't charge your card. Retry payment to avoid losing access."
                : "Your subscription is suspended. Update billing to restore access."}
            </div>
            <Link
              href="/billing"
              onClick={onNavigate}
              className="flex h-8 w-full items-center justify-center rounded-[7px] bg-red text-[12.5px] font-semibold text-white"
            >
              Go to billing
            </Link>
          </div>
        </div>
      )}
      {!collapsed && trialStatus === "trialing" && trialEndsAt && (
        <div className="border-t border-border p-2.5">
          <div
            className="rounded-[11px] border border-border p-3"
            style={{ background: "linear-gradient(150deg,var(--accent-weak),transparent)" }}
          >
            <div className="mb-0.5 text-[12.5px] font-bold">Trial · {daysUntil(trialEndsAt)} day(s) left</div>
            <div className="mb-2.5 text-[11.5px] leading-snug text-text-2">Add a plan to keep access after your trial ends.</div>
            <Link
              href="/billing"
              onClick={onNavigate}
              className="flex h-8 w-full items-center justify-center rounded-[7px] bg-accent text-[12.5px] font-semibold text-white"
            >
              View billing
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
