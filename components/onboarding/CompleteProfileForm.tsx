"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/actions/auth";
import { COUNTRIES, statesForCountry } from "@/lib/geo/countries";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Props {
  canEditBusiness: boolean;
  businessName: string;
  businessEmail: string;
  country: string;
  state: string;
  termsAccepted: boolean;
}

export function CompleteProfileForm({ canEditBusiness, businessName, businessEmail, country, state, termsAccepted }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ businessName, businessEmail, country, state });
  const [accepted, setAccepted] = useState(termsAccepted);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const states = useMemo(() => statesForCountry(form.country), [form.country]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (canEditBusiness && !form.country) {
      setError("Country is required.");
      return;
    }
    if (!accepted) {
      setError("You must accept the Terms & Conditions and Privacy Policy.");
      return;
    }

    setSaving(true);
    try {
      await completeOnboarding({
        businessName: canEditBusiness ? form.businessName : undefined,
        businessEmail: canEditBusiness ? form.businessEmail : undefined,
        country: canEditBusiness ? form.country : undefined,
        state: canEditBusiness ? form.state : undefined,
        termsAccepted: accepted,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {canEditBusiness && (
        <>
          <Field label="Business name" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
          <Field
            label="Business email (optional)"
            type="email"
            value={form.businessEmail}
            onChange={(e) => set("businessEmail", e.target.value)}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Select
                label="Country"
                value={form.country}
                onChange={(e) => {
                  set("country", e.target.value);
                  set("state", "");
                }}
              >
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {states.length > 0 && (
              <div className="flex-1">
                <Select label="State/Province" value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select state…</option>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </>
      )}

      {!accepted && (
        <label className="flex items-start gap-2 text-[12.5px] text-text-2">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
          <span>I agree to the Terms &amp; Conditions and Privacy Policy.</span>
        </label>
      )}

      {error && <p className="text-[13px] font-medium text-red">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Continue to dashboard"}
      </Button>
    </form>
  );
}
