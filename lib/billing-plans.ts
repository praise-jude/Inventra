import type { BillingInterval } from "@/lib/supabase/database.types";

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
    price: 1500,
    interval: "monthly",
    desc: "Billed every month, cancel anytime.",
    features: ["Everything in Inventra", "Auto-renews monthly", "Cancel or switch anytime"],
    cta: "Choose Monthly",
    selectable: true,
  },
  {
    key: "yearly",
    name: "Yearly",
    price: 15000,
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
