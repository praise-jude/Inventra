import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingBag,
  Wallet,
  AlertTriangle,
  Search,
  Bell,
  LayoutGrid,
} from "lucide-react";
import { MotionSection } from "./MotionSection";
import { SalesBars, RevenueLine, DonutRing } from "./charts";

const STATS = [
  { label: "Revenue", value: "₦4,286,900", change: "+18.4%", up: true, icon: Wallet },
  { label: "Orders", value: "1,842", change: "+9.1%", up: true, icon: ShoppingBag },
  { label: "Net Profit", value: "₦912,400", change: "+12.7%", up: true, icon: TrendingUp },
  { label: "Low Stock", value: "6 items", change: "-2 today", up: false, icon: AlertTriangle },
];

const INVENTORY = [
  { name: "Samsung Galaxy A15", sku: "SKU-2291", stock: 84, status: "In stock" },
  { name: "Peak Milk 400g", sku: "SKU-1187", stock: 12, status: "Low stock" },
  { name: "Dettol Soap 3-pack", sku: "SKU-0932", stock: 240, status: "In stock" },
  { name: "HP LaserJet Toner", sku: "SKU-5541", stock: 3, status: "Critical" },
];

const ORDERS = [
  { id: "#INV-8231", customer: "Chidinma Okafor", amount: "₦48,200", status: "Paid" },
  { id: "#INV-8230", customer: "Femi Adewale", amount: "₦12,750", status: "Paid" },
  { id: "#INV-8229", customer: "Grace Umeh", amount: "₦96,000", status: "Pending" },
];

const statusColor: Record<string, string> = {
  "In stock": "var(--green)",
  "Low stock": "var(--amber)",
  Critical: "var(--red)",
  Paid: "var(--green)",
  Pending: "var(--amber)",
};

export function DashboardShowcase() {
  return (
    <section id="dashboard" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          A dashboard that sees everything
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-text-2">
          Sales, inventory, orders, and profit — all in one real-time view of your business.
        </p>
      </div>

      <MotionSection className="relative isolate mt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] opacity-50 blur-3xl"
          style={{ background: "linear-gradient(120deg, var(--teal-weak), var(--accent-weak))" }}
        />
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]">
          {/* Chrome */}
          <div className="flex items-center justify-between border-b border-border-2 bg-surface-2 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                <span className="h-2.5 w-2.5 rounded-full bg-green" />
              </div>
              <span className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-faint sm:flex">
                <LayoutGrid size={11} /> inventra.app/dashboard
              </span>
            </div>
            <div className="flex items-center gap-3 text-faint">
              <Search size={15} />
              <Bell size={15} />
              <span className="h-6 w-6 rounded-full" style={{ background: "linear-gradient(135deg, var(--teal), var(--accent))" }} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-4">
            {STATS.map(({ label, value, change, up, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border-2 bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--accent-weak)", color: "var(--accent-text)" }}
                  >
                    <Icon size={15} />
                  </span>
                  <span
                    className="flex items-center gap-0.5 text-[11px] font-semibold"
                    style={{ color: up ? "var(--green)" : "var(--amber)" }}
                  >
                    {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {change}
                  </span>
                </div>
                <p className="mt-3 text-[19px] font-extrabold text-text">{value}</p>
                <p className="text-[11.5px] font-medium text-faint">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:grid-cols-3">
            {/* Revenue chart */}
            <div className="rounded-xl border border-border-2 bg-surface-2 p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold text-text">Revenue overview</p>
                <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-faint">
                  Last 30 days
                </span>
              </div>
              <div className="h-24">
                <RevenueLine className="h-full w-full" />
              </div>
              <div className="mt-2 h-16">
                <SalesBars />
              </div>
            </div>

            {/* Profit donut */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-border-2 bg-surface-2 p-4">
              <p className="mb-3 self-start text-[13px] font-bold text-text">Profit margin</p>
              <div className="relative flex items-center justify-center">
                <DonutRing percent={68} size={104} />
                <span className="absolute text-[20px] font-extrabold text-text">68%</span>
              </div>
              <p className="mt-3 text-center text-[11.5px] text-faint">Gross margin across all branches this month</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-2">
            {/* Inventory table */}
            <div className="rounded-xl border border-border-2 bg-surface-2 p-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-text">
                <Package size={14} className="text-accent" /> Inventory
              </p>
              <div className="flex flex-col gap-2.5">
                {INVENTORY.map((p) => (
                  <div key={p.sku} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-text">{p.name}</p>
                      <p className="text-[11px] text-faint">{p.sku}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: `color-mix(in srgb, ${statusColor[p.status]} 15%, transparent)`, color: statusColor[p.status] }}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent orders */}
            <div className="rounded-xl border border-border-2 bg-surface-2 p-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-text">
                <ShoppingBag size={14} className="text-accent" /> Recent orders
              </p>
              <div className="flex flex-col gap-2.5">
                {ORDERS.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-text">{o.customer}</p>
                      <p className="text-[11px] text-faint">{o.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12.5px] font-bold text-text">{o.amount}</p>
                      <span className="text-[10.5px] font-semibold" style={{ color: statusColor[o.status] }}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </MotionSection>
    </section>
  );
}
