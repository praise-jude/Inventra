"use client";

import { PLANS } from "@/lib/billing-plans";
import { formatMoney } from "@/lib/currency";

interface Props {
  selected: "monthly" | "yearly";
  onSelect: (key: "monthly" | "yearly") => void;
  onContinue: () => void;
}

export function PlanSelectStep({ selected, onSelect, onContinue }: Props) {
  const selectablePlans = PLANS.filter((p) => p.selectable);

  return (
    <div>
      <div className="mb-4 rounded-[10px] border border-border bg-hover px-4 py-3 text-[13px] text-text-2">
        Your 6-day free trial starts right after you add a card below — you won&apos;t be charged until the trial ends,
        and you can cancel anytime before then.
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {selectablePlans.map((plan) => {
          const isSelected = plan.key === selected;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onSelect(plan.key as "monthly" | "yearly")}
              className="relative rounded-2xl border p-4 text-left transition-colors"
              style={{
                borderWidth: isSelected ? 1.5 : 1,
                borderColor: isSelected ? "var(--accent)" : "var(--border)",
                background: isSelected ? "var(--accent-weak)" : "var(--surface)",
              }}
            >
              {plan.badge && (
                <div className="absolute -top-px right-4 rounded-b-[7px] bg-green px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-white">
                  {plan.badge}
                </div>
              )}
              <div className="text-[15px] font-bold">{plan.name}</div>
              <div className="mt-1 text-[24px] font-extrabold tracking-tight">
                {formatMoney(plan.price, "NGN")}
                <span className="text-[13px] font-semibold text-muted">/{plan.interval === "monthly" ? "mo" : "yr"}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-text-2">{plan.desc}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="h-[44px] w-full rounded-[9px] bg-accent text-[14px] font-bold text-white"
      >
        Continue to secure payment
      </button>
    </div>
  );
}
