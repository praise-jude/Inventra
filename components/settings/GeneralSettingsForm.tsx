"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updateGeneralSettings } from "@/lib/actions/settings";
import { COUNTRIES, CURRENCY_CODES, IANA_TIMEZONES, statesForCountry, timezoneFor } from "@/lib/geo/countries";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Props {
  name: string;
  supportEmail: string;
  currency: string;
  country: string;
  state: string;
  timezone: string;
  taxRate: number;
  themePreference: string;
}

export function GeneralSettingsForm({ name, supportEmail, currency, country, state, timezone, taxRate, themePreference }: Props) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({ name, supportEmail, currency, country, state, timezone, taxRate: String(taxRate) });
  const [saving, setSaving] = useState(false);
  const states = useMemo(() => statesForCountry(form.country), [form.country]);

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
        country: form.country,
        state: form.state,
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
          <Select
            label="Country"
            value={form.country}
            onChange={(e) => {
              const nextCountry = e.target.value;
              setForm((f) => ({ ...f, country: nextCountry, state: "", timezone: timezoneFor(nextCountry) }));
            }}
          >
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          {states.length > 0 ? (
            <Select
              label="State/Province"
              value={form.state}
              onChange={(e) => {
                const nextState = e.target.value;
                setForm((f) => ({ ...f, state: nextState, timezone: timezoneFor(f.country, nextState) }));
              }}
            >
              <option value="">Select state…</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <Field label="State/Province" value={form.state} onChange={(e) => set("state", e.target.value)} />
          )}
          <Select label="Currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <Select label="Timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {!IANA_TIMEZONES.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
            {IANA_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
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
