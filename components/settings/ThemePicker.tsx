"use client";

import { useState } from "react";
import { setTheme } from "@/lib/actions/theme";

const OPTIONS: { key: "light" | "dark" | "system"; label: string; swatch: string }[] = [
  { key: "light", label: "Light", swatch: "#f6f8fb" },
  { key: "dark", label: "Dark", swatch: "#14171f" },
  { key: "system", label: "System", swatch: "linear-gradient(90deg,#f6f8fb 50%,#14171f 50%)" },
];

export function ThemePicker({ initialPreference }: { initialPreference: string }) {
  const [preference, setPreference] = useState(initialPreference);

  async function pick(key: "light" | "dark" | "system") {
    setPreference(key);
    const resolved = key === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : key;
    document.documentElement.setAttribute("data-theme", resolved);
    await setTheme(resolved, key);
  }

  return (
    <div className="flex gap-2.5">
      {OPTIONS.map((o) => {
        const active = preference === o.key;
        return (
          <div
            key={o.key}
            onClick={() => pick(o.key)}
            className="flex-1 cursor-pointer rounded-xl p-3 text-center"
            style={{
              border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
              background: active ? "var(--accent-weak)" : "var(--surface-2)",
            }}
          >
            <div className="mb-2 h-11 w-full rounded-lg border border-border" style={{ background: o.swatch }} />
            <span className="text-[12.5px] font-semibold">{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}
