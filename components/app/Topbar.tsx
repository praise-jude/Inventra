"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getStockAlerts, type StockAlert } from "@/lib/actions/alerts";
import { onDataChanged } from "@/lib/client-events";
import { usePresence } from "@/components/app/PresenceProvider";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/inventory/warehouses": "Warehouses",
  "/inventory/suppliers": "Suppliers",
  "/inventory": "Inventory",
  "/sales": "Sales",
  "/debtors": "Customers",
  "/reports": "Reports",
  "/audit-log": "Audit Log",
  "/expenses": "Expenses",
  "/team": "Team",
  "/notifications": "Notifications",
  "/billing": "Billing",
  "/settings": "Settings",
  "/account/security": "Security",
  "/support": "Contact support",
};

function routeTitle(pathname: string) {
  const match = Object.keys(TITLES)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  return match ? TITLES[match] : "Dashboard";
}

export function Topbar({
  initials,
  firstName,
  theme,
  onToggleTheme,
  onOpenPalette,
  onToggleSidebar,
}: {
  initials: string;
  firstName: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { selfStatus } = usePresence();
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Refresh stock alerts on every navigation so the badge tracks reality.
  useEffect(() => {
    getStockAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, [pathname]);

  // Also refresh immediately when a product/stock mutation happens on the
  // current page — without this the bell would only catch up on the next
  // navigation, even though the edit already persisted.
  useEffect(() => {
    return onDataChanged(() => {
      getStockAlerts().then(setAlerts).catch(() => setAlerts([]));
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-[58px] flex-shrink-0 items-center gap-3.5 border-b border-border bg-surface/85 px-5 backdrop-blur-md">
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="hamburger hidden h-[34px] w-[34px] rounded-[8px] border border-border bg-surface text-text"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="text-[16px] font-bold tracking-tight">{routeTitle(pathname)}</div>
      <button
        onClick={onOpenPalette}
        className="topsearch ml-3.5 flex h-9 max-w-[340px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-surface-2 px-3 text-[13px] text-muted hover:bg-hover"
      >
        <span className="text-[13px]">⌕</span>
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="rounded-[5px] border border-border px-1.5 py-px font-mono text-[11px] text-faint">
          ⌘K
        </span>
      </button>
      <div className="topspacer flex-1" />
      <div className="relative" ref={helpRef}>
        <button
          onClick={() => setHelpOpen((v) => !v)}
          title="Help"
          aria-label="Help"
          aria-expanded={helpOpen}
          className="h-9 w-9 rounded-[9px] border border-border bg-surface text-[15px] text-text hover:bg-hover"
        >
          <span aria-hidden="true">?</span>
        </button>
        {helpOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-[240px] rounded-[12px] border border-border bg-surface p-2 shadow-[var(--shadow)]">
            <button
              onClick={() => {
                setHelpOpen(false);
                onOpenPalette();
              }}
              className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-text hover:bg-hover"
            >
              <span>Command palette</span>
              <span className="rounded-[5px] border border-border px-1.5 py-px font-mono text-[11px] text-faint">⌘K</span>
            </button>
            <Link
              href="/support"
              onClick={() => setHelpOpen(false)}
              className="block rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-text hover:bg-hover"
            >
              Contact support
            </Link>
          </div>
        )}
      </div>
      <button
        onClick={onToggleTheme}
        title="Toggle theme"
        aria-label="Toggle theme"
        className="h-9 w-9 rounded-[9px] border border-border bg-surface text-[15px] text-text hover:bg-hover"
      >
        <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
      </button>
      <div className="relative" ref={alertsRef}>
        <button
          onClick={() => setAlertsOpen((v) => !v)}
          title="Stock alerts"
          aria-label={`Stock alerts${alerts.length > 0 ? ` (${alerts.length})` : ""}`}
          aria-expanded={alertsOpen}
          className="relative h-9 w-9 rounded-[9px] border border-border bg-surface text-[15px] text-text hover:bg-hover"
        >
          <span aria-hidden="true">🔔</span>
          {alerts.length > 0 && (
            <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-red" />
          )}
        </button>
        {alertsOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-[320px] rounded-[12px] border border-border bg-surface shadow-[var(--shadow)]">
            <div className="border-b border-border-2 px-3.5 py-2.5 text-[13px] font-bold">
              Stock alerts {alerts.length > 0 && <span className="text-muted">({alerts.length})</span>}
            </div>
            <div className="scroll max-h-[320px] overflow-y-auto py-1">
              {alerts.length === 0 && (
                <div className="px-3.5 py-5 text-center text-[12.5px] text-muted">All clear — no stock alerts.</div>
              )}
              {alerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setAlertsOpen(false);
                    router.push(`/products?open=${a.productId}`);
                  }}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-hover"
                >
                  <span
                    className="mt-px flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-[13px]"
                    style={{ background: `var(--${a.severity}-weak)` }}
                  >
                    {a.emoji ?? "📦"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{a.title}</span>
                    <span className="block text-[11.5px] text-muted">{a.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={menuOpen}
          className="flex h-9 items-center gap-2 rounded-[9px] border border-border bg-surface py-[3px] pl-[3px] pr-2.5 hover:bg-hover"
        >
          <div className="relative">
            <div
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[12px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#2563eb,#6366f1)" }}
            >
              {initials}
            </div>
            <span
              title={selfStatus === "online" ? "Online" : "Idle"}
              className="absolute -right-[2px] -top-[2px] h-[9px] w-[9px] rounded-full border-[1.5px] border-surface"
              style={{ background: selfStatus === "online" ? "var(--green)" : "var(--amber)" }}
            />
          </div>
          <span className="username text-[13px] font-semibold">{firstName}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-[170px] rounded-[10px] border border-border bg-surface py-1.5 shadow-[var(--shadow)]">
            <button
              onClick={() => router.push("/settings")}
              className="block w-full px-3.5 py-2 text-left text-[13px] font-medium text-text hover:bg-hover"
            >
              Settings
            </button>
            <button
              onClick={() => router.push("/account/security")}
              className="block w-full px-3.5 py-2 text-left text-[13px] font-medium text-text hover:bg-hover"
            >
              Security
            </button>
            <button
              onClick={handleLogout}
              className="block w-full px-3.5 py-2 text-left text-[13px] font-medium text-red hover:bg-hover"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
