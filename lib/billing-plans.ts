export interface PlanDef {
  key: string;
  name: string;
  price: number;
  seatLimit: number;
  skuLimit: number;
  warehouseLimit: number;
  desc: string;
  features: string[];
  cta: string;
  badge?: string;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    key: "starter",
    name: "Starter",
    price: 0,
    seatLimit: 2,
    skuLimit: 500,
    warehouseLimit: 1,
    desc: "For a single store finding its feet.",
    features: ["Up to 500 SKUs", "1 warehouse", "2 team seats", "Basic reports"],
    cta: "Start with Starter",
  },
  {
    key: "growth",
    name: "Growth",
    price: 99,
    seatLimit: 15,
    skuLimit: Infinity,
    warehouseLimit: 5,
    desc: "For growing multi-store retailers.",
    features: ["Unlimited SKUs", "5 warehouses", "15 team seats", "Demand forecasting", "API access"],
    cta: "Choose Growth",
    badge: "Most popular",
    highlight: true,
  },
  {
    key: "scale",
    name: "Scale",
    price: 249,
    seatLimit: Infinity,
    skuLimit: Infinity,
    warehouseLimit: Infinity,
    desc: "For wholesalers & chains.",
    features: ["Everything in Growth", "Unlimited warehouses", "SSO & audit logs", "Dedicated success mgr", "99.99% SLA"],
    cta: "Go Scale",
    badge: "Best value",
  },
];

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  issued_at: string;
}
