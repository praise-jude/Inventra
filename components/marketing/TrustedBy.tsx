import {
  ShoppingBag,
  Pill,
  ShoppingCart,
  UtensilsCrossed,
  Warehouse,
  Cpu,
  Shirt,
  Printer,
} from "lucide-react";

const INDUSTRIES = [
  { label: "Retail", icon: ShoppingBag },
  { label: "Pharmacy", icon: Pill },
  { label: "Supermarket", icon: ShoppingCart },
  { label: "Restaurant", icon: UtensilsCrossed },
  { label: "Warehouse", icon: Warehouse },
  { label: "Electronics", icon: Cpu },
  { label: "Fashion", icon: Shirt },
  { label: "Printing", icon: Printer },
];

export function TrustedBy() {
  const loop = [...INDUSTRIES, ...INDUSTRIES];
  return (
    <section className="border-y border-border-2 bg-surface-2 py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="mb-7 text-center text-[13px] font-semibold uppercase tracking-wide text-faint">
          Trusted by businesses across every industry
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface-2 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface-2 to-transparent" />
        <div className="animate-marquee flex w-max gap-4 px-5">
          {loop.map(({ label, icon: Icon }, i) => (
            <div
              key={`${label}-${i}`}
              className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-5 py-2.5 shadow-[var(--shadow-sm)]"
            >
              <Icon size={16} className="text-accent" />
              <span className="whitespace-nowrap text-[13.5px] font-semibold text-text-2">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
