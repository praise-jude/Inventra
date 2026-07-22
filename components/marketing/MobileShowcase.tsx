import type { ReactNode } from "react";
import { ScanLine, Gauge, Moon, ShoppingCart, Boxes, TrendingUp } from "lucide-react";
import { MotionSection } from "./MotionSection";
import { SalesBars } from "./charts";

const FEATURE_CHIPS = [
  { icon: Gauge, label: "Dashboard" },
  { icon: ShoppingCart, label: "POS" },
  { icon: Boxes, label: "Inventory" },
  { icon: ScanLine, label: "Barcode Scanner" },
  { icon: TrendingUp, label: "Sales" },
  { icon: Moon, label: "Dark Mode" },
];

function PhoneFrame({
  className = "",
  dark = false,
  children,
}: {
  className?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`w-[240px] shrink-0 rounded-[36px] border-[6px] p-1.5 shadow-[var(--shadow-lg)] ${className}`}
      style={{
        borderColor: dark ? "#1a1d24" : "#e5e7eb",
        background: dark ? "#0b0d12" : "#ffffff",
      }}
    >
      <div className="mx-auto mb-1 h-5 w-24 rounded-full" style={{ background: dark ? "#1a1d24" : "#e5e7eb" }} />
      <div
        className="flex h-[420px] flex-col overflow-hidden rounded-[26px] p-3.5"
        style={{ background: dark ? "#12151c" : "#f8fafc" }}
      >
        {children}
      </div>
    </div>
  );
}

export function MobileShowcase() {
  return (
    <section className="overflow-hidden py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <MotionSection>
          <h2 className="text-[32px] font-extrabold leading-tight tracking-tight text-text sm:text-[40px]">
            Your business, in your pocket
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-text-2">
            Ring up sales, scan barcodes, and check stock from anywhere with the Inventra mobile
            app — online or offline.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent-weak)", color: "var(--accent-text)" }}>
                  <Icon size={13} />
                </span>
                <span className="text-[12.5px] font-semibold text-text-2">{label}</span>
              </div>
            ))}
          </div>
        </MotionSection>

        <div className="relative flex justify-center gap-6 pb-6 pt-4 lg:justify-end">
          <div className="animate-card-float mt-10">
            <PhoneFrame dark>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Sales · Today</p>
              <p className="text-[22px] font-extrabold text-white">₦186,400</p>
              <div className="mt-3 h-16">
                <SalesBars />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {["POS Sale #4821", "POS Sale #4820", "POS Sale #4819"].map((s) => (
                  <div key={s} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-[11px] font-medium text-white/80">{s}</span>
                    <span className="text-[11px] font-bold text-green">Paid</span>
                  </div>
                ))}
              </div>
            </PhoneFrame>
          </div>

          <div className="animate-card-float hidden sm:block" style={{ animationDelay: "-2.5s" }}>
            <PhoneFrame>
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                <ScanLine size={12} /> Scan barcode
              </p>
              <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-accent/40 bg-accent-weak">
                <ScanLine size={40} className="text-accent" />
              </div>
              <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2.5">
                <p className="text-[12px] font-bold text-text">Samsung Galaxy A15</p>
                <p className="text-[11px] text-faint">SKU-2291 · 84 in stock</p>
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
