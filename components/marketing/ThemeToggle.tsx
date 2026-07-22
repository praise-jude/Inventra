"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { setTheme } from "@/lib/actions/theme";

export function ThemeToggle({
  initialTheme,
  className = "",
}: {
  initialTheme: "light" | "dark";
  className?: string;
}) {
  const [resolved, setResolved] = useState<"light" | "dark">(initialTheme);

  async function toggle() {
    const next = resolved === "dark" ? "light" : "dark";
    setResolved(next);
    document.documentElement.setAttribute("data-theme", next);
    await setTheme(next, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-2 transition-colors hover:bg-hover ${className}`}
    >
      {resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
