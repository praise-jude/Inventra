"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { setTheme } from "@/lib/actions/theme";

// No `initialTheme` prop — the pages that render this (marketing home,
// /download) no longer read the theme cookie server-side, which is what
// lets them be static/CDN-cached instead of forced dynamic on every
// request. The real value is read client-side after mount, from whatever
// app/layout.tsx's pre-hydration script already applied to <html> — same
// render (null) on the server and the client's first pass, so there's no
// hydration mismatch, just a same-frame swap to the real icon right after.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [resolved, setResolved] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // A lazy useState initializer would run this same document.
    // documentElement read during the client's hydration pass too, but with
    // a *different* result than the server (which has no `document` at
    // all) — that's the exact server/client-branch pattern that causes a
    // hydration mismatch (see the React #418 fix elsewhere in this repo).
    // Deferring to an effect keeps the mount render identical (null) on
    // both sides, then swaps in the real value right after.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);

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
      disabled={resolved === null}
      aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-2 transition-colors hover:bg-hover ${className}`}
    >
      {resolved === "dark" ? <Sun size={16} /> : resolved === "light" ? <Moon size={16} /> : null}
    </button>
  );
}
