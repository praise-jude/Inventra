"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "▦" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/inventory", label: "Inventory", icon: "🗃️" },
  { href: "/team", label: "Team", icon: "👥", adminOnly: true },
  { href: "/billing", label: "Billing", icon: "💳" },
  { href: "/settings", label: "Settings", icon: "⚙️", adminOnly: true },
];

export function Sidebar({
  orgName,
  plan,
  inventoryBadge,
  role,
  open,
  onNavigate,
}: {
  orgName: string;
  plan: string;
  inventoryBadge: number;
  role: string;
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = role === "owner" || role === "admin";
  const nav = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`app-sidebar flex h-screen w-[236px] flex-shrink-0 flex-col border-r border-border bg-surface ${open ? "open" : ""}`}
      style={{ position: "sticky", top: 0 }}
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-accent text-[15px] font-extrabold text-white">
          S
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold tracking-tight">Stockwell</div>
        </div>
      </div>
      <div className="px-3 pb-2.5 pt-1">
        <button className="flex w-full items-center gap-2.5 rounded-[9px] border border-border bg-surface-2 p-2 text-left hover:bg-hover">
          <div
            className="h-6 w-6 flex-shrink-0 rounded-[6px]"
            style={{ background: "linear-gradient(135deg,#12805c,#3ddc9a)" }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-text">{orgName}</div>
            <div className="text-[11px] capitalize text-muted">{plan} plan</div>
          </div>
          <span className="text-[11px] text-faint">⌄</span>
        </button>
      </div>
      <nav className="scroll flex-1 overflow-y-auto px-2.5 py-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const badge = item.href === "/inventory" && inventoryBadge > 0 ? inventoryBadge : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="mb-0.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] hover:bg-hover"
              style={{
                fontWeight: active ? 700 : 500,
                color: active ? "var(--accent-text)" : "var(--text-2)",
                background: active ? "var(--accent-weak)" : "transparent",
              }}
            >
              <span className="w-[18px] text-center text-[15px]" style={{ filter: "grayscale(.2)" }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {badge !== null && (
                <span className="rounded-[20px] bg-amber-weak px-1.5 py-px font-mono text-[10.5px] font-bold text-amber">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2.5">
        <div
          className="rounded-[11px] border border-border p-3"
          style={{ background: "linear-gradient(150deg,var(--accent-weak),transparent)" }}
        >
          <div className="mb-0.5 text-[12.5px] font-bold">Trial · 6 days left</div>
          <div className="mb-2.5 text-[11.5px] leading-snug text-text-2">
            Unlock forecasting &amp; unlimited SKUs.
          </div>
          <Link
            href="/billing"
            onClick={onNavigate}
            className="flex h-8 w-full items-center justify-center rounded-[7px] bg-accent text-[12.5px] font-semibold text-white"
          >
            Upgrade plan
          </Link>
        </div>
      </div>
    </aside>
  );
}
