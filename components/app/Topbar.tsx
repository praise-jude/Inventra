"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/app/ToastProvider";

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/products": "Products",
  "/inventory": "Inventory",
  "/team": "Team",
  "/billing": "Billing",
  "/settings": "Settings",
};

function routeTitle(pathname: string) {
  const match = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  return match ? TITLES[match] : "Overview";
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
  const flash = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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
        className="hamburger hidden h-[34px] w-[34px] rounded-[8px] border border-border bg-surface text-text"
      >
        ☰
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
      <button
        onClick={onToggleTheme}
        title="Toggle theme"
        className="h-9 w-9 rounded-[9px] border border-border bg-surface text-[15px] text-text hover:bg-hover"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>
      <button
        onClick={() => flash("You have 5 unread notifications")}
        className="relative h-9 w-9 rounded-[9px] border border-border bg-surface text-[15px] text-text hover:bg-hover"
      >
        🔔
        <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-red" />
      </button>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-[9px] border border-border bg-surface py-[3px] pl-[3px] pr-2.5 hover:bg-hover"
        >
          <div
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[12px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#635bff,#8a86ff)" }}
          >
            {initials}
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
