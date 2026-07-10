import type { PlanDef } from "@/lib/billing-plans";

function Check() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="mt-0.5 shrink-0 text-green">
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface PricingPlansProps {
  plans: PlanDef[];
  currentPlanKey: string;
  busyKey: string | null;
  onChoosePlan: (key: string) => void;
  formatMoney: (amount: number) => string;
}

export function PricingPlans({ plans, currentPlanKey, busyKey, onChoosePlan, formatMoney }: PricingPlansProps) {
  const currentIndex = plans.findIndex((p) => p.key === currentPlanKey);

  return (
    <div className="mb-5 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
      {plans.map((plan, i) => {
        const isCurrent = plan.key === currentPlanKey;
        const isBusy = busyKey === plan.key;
        const direction = i > currentIndex ? "Upgrade" : "Downgrade";
        const label = isCurrent ? "Current plan" : isBusy ? "Switching…" : `${plan.cta} (${direction})`;

        return (
          <div
            key={plan.key}
            className="relative flex flex-col rounded-2xl border bg-surface p-5"
            style={{
              borderWidth: isCurrent || plan.highlight ? 1.5 : 1,
              borderColor: isCurrent ? "var(--accent)" : plan.highlight ? "var(--green)" : "var(--border)",
              boxShadow: isCurrent || plan.highlight ? "var(--shadow)" : "var(--shadow-sm)",
            }}
          >
            {(isCurrent || plan.badge) && (
              <div
                className="absolute -top-px right-4 rounded-b-[7px] px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-white"
                style={{ background: isCurrent ? "var(--accent)" : "var(--green)" }}
              >
                {isCurrent ? "Current" : plan.badge}
              </div>
            )}

            <div className="text-[16px] font-bold">{plan.name}</div>
            <div className="mt-1.5 text-[28px] font-extrabold tracking-tight">
              {formatMoney(plan.price)}
              <span className="text-[14px] font-semibold text-muted">/mo</span>
            </div>
            <div className="mb-3.5 mt-0.5 text-[12.5px] leading-relaxed text-text-2">{plan.desc}</div>

            <div className="mb-4 flex flex-col gap-2">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-[12.5px] text-text-2">
                  <Check />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              disabled={isCurrent || busyKey !== null}
              onClick={() => onChoosePlan(plan.key)}
              className="mt-auto h-[38px] rounded-[9px] text-[13px] font-semibold disabled:cursor-not-allowed"
              style={
                isCurrent
                  ? { border: "1px solid var(--border)", background: "var(--hover)", color: "var(--muted)" }
                  : { border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }
              }
            >
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
