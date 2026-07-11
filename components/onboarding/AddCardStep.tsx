"use client";

import { useState } from "react";
import { planByKey } from "@/lib/billing-plans";
import { formatMoney } from "@/lib/currency";
import { initiateAddCard } from "@/lib/actions/billing";

interface Props {
  planKey: "monthly" | "yearly";
  onBack: () => void;
}

export function AddCardStep({ planKey, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = planByKey(planKey)!;

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const { authorizationUrl } = await initiateAddCard(planKey);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start card setup. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-[10px] border border-border bg-hover px-4 py-3 text-[13px] text-text-2">
        You&apos;ll be redirected to Paystack&apos;s secure checkout to add your card. We verify the card with a small,
        fully refunded charge — your card is tokenized by Paystack and never touches our servers.
      </div>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <div>
          <div className="text-[13.5px] font-semibold">{plan.name} plan</div>
          <div className="text-[11.5px] text-muted">Billed after your 6-day free trial ends</div>
        </div>
        <div className="text-[16px] font-bold">
          {formatMoney(plan.price, "NGN")}
          <span className="text-[12px] font-semibold text-muted">/{plan.interval === "monthly" ? "mo" : "yr"}</span>
        </div>
      </div>
      {error && <p className="mb-3 text-[12.5px] font-medium text-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="h-[44px] flex-1 rounded-[9px] border border-border bg-surface text-[14px] font-semibold text-text-2"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="h-[44px] flex-[2] rounded-[9px] bg-accent text-[14px] font-bold text-white disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Add card & start trial"}
        </button>
      </div>
    </div>
  );
}
