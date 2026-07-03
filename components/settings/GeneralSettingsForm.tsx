"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updateGeneralSettings } from "@/lib/actions/settings";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Props {
  name: string;
  supportEmail: string;
  currency: string;
  timezone: string;
  taxRate: number;
  themePreference: string;
}

export function GeneralSettingsForm({ name, supportEmail, currency, timezone, taxRate, themePreference }: Props) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({ name, supportEmail, currency, timezone, taxRate: String(taxRate) });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGeneralSettings({
        name: form.name,
        supportEmail: form.supportEmail,
        currency: form.currency,
        timezone: form.timezone,
        taxRate: parseFloat(form.taxRate) || 0,
      });
      flash("Settings saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 text-[15px] font-bold">Business information</div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Business name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Field label="Support email" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
          <Field label="Currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          <Field label="Timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
          <Field label="Default tax rate (%)" type="number" step="0.01" value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="text-[15px] font-bold">Appearance</div>
        <div className="mb-3.5 mt-1 text-[12.5px] text-text-2">Choose how Stockwell looks on this device.</div>
        <ThemePicker initialPreference={themePreference} />
      </div>
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary">Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
