"use client";

import { useState } from "react";
import { requestAccountDeletion } from "@/lib/actions/account-deletion";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function DeleteAccountRequestForm() {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("businessName", businessName);
    formData.set("details", details);
    const result = await requestAccountDeletion(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-[15px] font-semibold text-text">Request received</h2>
        <p className="mt-1.5 text-[13.5px] text-text-2">
          We&apos;ve emailed <b className="text-text">{email}</b> a confirmation. We&apos;ll verify the
          request and complete the deletion within 30 days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-6">
      <Field
        label="Account email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />
      <Field
        label="Business / organization name (optional)"
        type="text"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Helps us find your account faster"
      />
      <div>
        <label htmlFor="deletion-details" className="mb-1.5 block text-[12.5px] font-semibold text-text-2">
          Anything else we should know? (optional)
        </label>
        <textarea
          id="deletion-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-[9px] border border-border bg-surface px-[13px] py-2.5 text-[14px] text-text outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-weak)]"
        />
      </div>
      {error && <p className="text-[13px] font-medium text-red">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting…" : "Request account deletion"}
      </Button>
    </form>
  );
}
