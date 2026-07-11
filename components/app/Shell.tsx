"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { CommandPalette } from "@/components/app/CommandPalette";
import { setTheme as persistTheme } from "@/lib/actions/theme";

export function Shell({
  orgName,
  plan,
  trialStatus,
  trialEndsAt,
  inventoryBadge,
  initials,
  firstName,
  initialTheme,
  role,
  children,
}: {
  orgName: string;
  plan: string;
  trialStatus: string | null;
  trialEndsAt: string | null;
  inventoryBadge: number;
  initials: string;
  firstName: string;
  initialTheme: "light" | "dark";
  role: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark">(initialTheme);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      persistTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="animate-fade-in fixed inset-0 z-50 hidden bg-[rgba(15,20,32,.4)] max-[880px]:block"
        />
      )}
      <Sidebar
        orgName={orgName}
        plan={plan}
        trialStatus={trialStatus}
        trialEndsAt={trialEndsAt}
        inventoryBadge={inventoryBadge}
        role={role}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          initials={initials}
          firstName={firstName}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="scroll app-main flex-1 overflow-y-auto">
          <div className="content-pad mx-auto max-w-[1320px] px-[26px] pb-[60px] pt-6">
            {children}
          </div>
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onToggleTheme={toggleTheme} />}
    </div>
  );
}
