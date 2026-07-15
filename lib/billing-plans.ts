import type { BillingInterval } from "@/lib/supabase/database.types";

// Public (NEXT_PUBLIC_) because this module is imported from both server
// code (webhook, billing-service) and client components (BillingClient.tsx)
// — so pricing can be changed via env var without a code edit, without
// needing two separate constants for the two bundles.
//
// IMPORTANT: this only changes what the app displays/charges through
// chargeAuthorization (e.g. reactivateSubscription's immediate charge).
// Paystack's own auto-recurring subscription cycle (createSubscription,
// used by changePlan/handleInitialCardVerification) bills whatever amount
// is baked into the PAYSTACK_PLAN_CODE_MONTHLY/YEARLY Plan objects on
// Paystack's side — changing this constant does NOT change that. Renewing
// pricing requires creating new Paystack Plans at the new amount and
// swapping those env vars too, or renewal charges will silently stay at
// the old price.
const MONTHLY_PRICE = Number(process.env.NEXT_PUBLIC_PLAN_PRICE_MONTHLY ?? 5000);
const YEARLY_PRICE = Number(process.env.NEXT_PUBLIC_PLAN_PRICE_YEARLY ?? 50000);

export interface PlanDef {
  key: "trial" | "monthly" | "yearly";
  name: string;
  price: number; // naira; 0 for the trial
  interval: BillingInterval | null; // null for the trial (not a recurring interval itself)
  desc: string;
  features: string[];
  cta: string;
  badge?: string;
  highlight?: boolean;
  selectable: boolean; // the trial tile is informational only, not a checkout target
}

export const PLANS: PlanDef[] = [
  {
    key: "trial",
    name: "Free Trial",
    price: 0,
    interval: null,
    desc: "6 days, full access, no charge until it ends.",
    features: ["Full access to every feature", "A card is required to activate it", "Cancel anytime before it ends"],
    cta: "Included with signup",
    selectable: false,
  },
  {
    key: "monthly",
    name: "Monthly",
    price: MONTHLY_PRICE,
    interval: "monthly",
    desc: "Billed every month, cancel anytime.",
    features: ["Everything in Inventra", "Auto-renews monthly", "Cancel or switch anytime"],
    cta: "Choose Monthly",
    selectable: true,
  },
  {
    key: "yearly",
    name: "Yearly",
    price: YEARLY_PRICE,
    interval: "yearly",
    desc: "Billed once a year — best value.",
    features: ["Everything in Inventra", "Two months free vs. monthly", "Auto-renews yearly"],
    cta: "Choose Yearly",
    badge: "Best value",
    highlight: true,
    selectable: true,
  },
];

export function planByKey(key: string): PlanDef | undefined {
  return PLANS.find((p) => p.key === key);
}
