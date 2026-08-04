"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { disconnectSlack, toggleIntegration } from "@/lib/actions/settings";
import { SlackConnectModal } from "@/components/settings/SlackConnectModal";

const META: Record<string, { name: string; desc: string; icon: string; bg: string }> = {
  stripe: { name: "Stripe", desc: "Payments & payouts", icon: "💳", bg: "var(--accent-weak)" },
  paystack: { name: "Paystack", desc: "Card & transfer", icon: "🏦", bg: "var(--sky-weak)" },
  quickbooks: { name: "QuickBooks", desc: "Accounting sync", icon: "📗", bg: "var(--green-weak)" },
  slack: { name: "Slack", desc: "Stock alerts to channels", icon: "💬", bg: "var(--amber-weak)" },
  google_drive: { name: "Google Drive", desc: "Report backups", icon: "📁", bg: "var(--sky-weak)" },
  webhooks: { name: "Webhooks", desc: "Custom event push", icon: "🔗", bg: "var(--accent-weak)" },
  pos_online: { name: "POS (Online)", desc: "Cloud-connected checkout terminals", icon: "🖥️", bg: "var(--accent-weak)" },
  pos_offline: { name: "POS (Offline)", desc: "Offline checkout, syncs when back online", icon: "📴", bg: "var(--amber-weak)" },
  receipt_printing: { name: "Receipt printing", desc: "Print receipts from sales & returns", icon: "🧾", bg: "var(--sky-weak)" },
};

export function IntegrationsClient({ initial }: { initial: { provider: string; status: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackBusy, setSlackBusy] = useState(false);

  function toggle(provider: string) {
    if (provider === "paystack" || provider === "slack") return; // handled separately below — a real connection, not a cosmetic toggle
    const connected = rows.find((r) => r.provider === provider)?.status === "connected";
    setRows((rs) => rs.map((r) => (r.provider === provider ? { ...r, status: connected ? "not_connected" : "connected" } : r)));
    startTransition(() => {
      toggleIntegration(provider, !connected);
    });
  }

  async function handleSlackClick(connected: boolean) {
    if (!connected) {
      setShowSlackModal(true);
      return;
    }
    if (!window.confirm("Disconnect Slack? Stock alerts will stop posting until you reconnect.")) return;
    setSlackBusy(true);
    try {
      await disconnectSlack();
      router.refresh();
    } finally {
      setSlackBusy(false);
    }
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
      {rows.map((r) => {
        const meta = META[r.provider];
        const connected = r.status === "connected";
        return (
          <div key={r.provider} className="rounded-[13px] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[18px]" style={{ background: meta.bg }}>
                {meta.icon}
              </span>
              {r.provider === "paystack" ? (
                <Link
                  href="/billing"
                  className="rounded-[20px] px-[9px] py-0.5 text-[11px] font-bold"
                  style={
                    connected
                      ? { color: "var(--green)", background: "var(--green-weak)" }
                      : { color: "var(--accent-text)", background: "var(--accent-weak)" }
                  }
                >
                  {connected ? "Connected" : "Manage in Billing"}
                </Link>
              ) : r.provider === "slack" ? (
                <button
                  type="button"
                  onClick={() => handleSlackClick(connected)}
                  disabled={slackBusy}
                  className="cursor-pointer rounded-[20px] px-[9px] py-0.5 text-[11px] font-bold disabled:opacity-60"
                  style={
                    connected
                      ? { color: "var(--green)", background: "var(--green-weak)" }
                      : { color: "var(--accent-text)", background: "var(--accent-weak)" }
                  }
                >
                  {connected ? "Connected" : "Connect"}
                </button>
              ) : (
                <span
                  onClick={() => toggle(r.provider)}
                  className="cursor-pointer rounded-[20px] px-[9px] py-0.5 text-[11px] font-bold"
                  style={
                    connected
                      ? { color: "var(--green)", background: "var(--green-weak)" }
                      : { color: "var(--accent-text)", background: "var(--accent-weak)" }
                  }
                >
                  {connected ? "Connected" : "Connect"}
                </span>
              )}
            </div>
            <div className="text-[13.5px] font-bold">{meta.name}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-text-2">{meta.desc}</div>
          </div>
        );
      })}
      {showSlackModal && <SlackConnectModal onClose={() => setShowSlackModal(false)} />}
    </div>
  );
}
