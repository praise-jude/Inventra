"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/integrations", label: "Integrations" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex gap-1 border-b border-border">
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
