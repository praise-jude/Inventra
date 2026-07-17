"use client";

import Link from "next/link";
import { useState } from "react";
import { updateSupportSettings } from "@/lib/actions/support-settings";
import type { SupportSettings } from "@/lib/queries/support-settings";
import { useToast } from "@/components/app/ToastProvider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={() => onChange(!on)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!on);
        }
      }}
      className="relative h-[23px] w-10 flex-shrink-0 cursor-pointer rounded-[20px] transition-colors"
      style={{ background: on ? "var(--accent)" : "var(--border)" }}
    >
      <div
        className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
        style={{ left: on ? "19px" : "2.5px" }}
      />
    </div>
  );
}

export function SupportSettingsClient({ settings }: { settings: SupportSettings }) {
  const flash = useToast();
  const [form, setForm] = useState({
    whatsappNumber: settings.whatsappNumber,
    whatsappMessage: settings.whatsappMessage,
    businessHours: settings.businessHours,
    supportEmail: settings.supportEmail,
    averageResponse: settings.averageResponse,
    whatsappEnabled: settings.whatsappEnabled,
    widgetEnabled: settings.widgetEnabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateSupportSettings(form);
      flash("Support settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[640px] animate-fade-up p-6">
      <Link href="/admin" className="text-[12.5px] font-semibold text-accent-text">
        ← Platform dashboard
      </Link>
      <div className="mb-[18px] mt-2">
        <div className="text-[22px] font-bold tracking-tight">Support settings</div>
        <div className="mt-[3px] text-text-2">WhatsApp support, shown to every user across every org.</div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold">Floating support widget</div>
              <div className="text-[12px] text-text-2">Master switch for the whole widget.</div>
            </div>
            <Toggle on={form.widgetEnabled} onChange={(v) => set("widgetEnabled", v)} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="text-[14px] font-bold">WhatsApp support</div>
            <Toggle on={form.whatsappEnabled} onChange={(v) => set("whatsappEnabled", v)} />
          </div>
          <div className="flex flex-col gap-3">
            <Field
              label="WhatsApp number (digits only, with country code)"
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              placeholder="2348036305562"
            />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Default message</label>
              <textarea
                value={form.whatsappMessage}
                onChange={(e) => set("whatsappMessage", e.target.value)}
                rows={4}
                className="w-full rounded-[9px] border border-border bg-surface px-[13px] py-2.5 text-[14px] text-text outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3.5 text-[14px] font-bold">Support details</div>
          <div className="flex flex-col gap-3">
            <Field
              label="Support email"
              type="email"
              value={form.supportEmail}
              onChange={(e) => set("supportEmail", e.target.value)}
            />
            <Field
              label="Business hours"
              value={form.businessHours}
              onChange={(e) => set("businessHours", e.target.value)}
            />
            <Field
              label="Average response time"
              value={form.averageResponse}
              onChange={(e) => set("averageResponse", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save support settings"}
        </Button>
      </form>
    </div>
  );
}
