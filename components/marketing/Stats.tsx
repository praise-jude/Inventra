import { ShieldCheck, RefreshCw, Building2, CloudCheck } from "lucide-react";

// Deliberately qualitative, not fabricated numbers — a product at this
// stage doesn't have "10,000+ businesses" to cite honestly, and inventing
// a number would be exactly the kind of claim this page shouldn't make.
// Swap these for real figures once there's real usage data to report.
const HIGHLIGHTS = [
  { icon: ShieldCheck, label: "Bank-level encryption" },
  { icon: RefreshCw, label: "Real-time sync across web & mobile" },
  { icon: Building2, label: "Built for multi-branch businesses" },
  { icon: CloudCheck, label: "Secure cloud infrastructure" },
];

export function Stats() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-surface px-6 py-10 shadow-[var(--shadow-sm)] sm:px-10 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-3 text-center">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-weak)", color: "var(--accent-text)" }}
              >
                <h.icon size={20} />
              </span>
              <p className="text-[13px] font-semibold leading-snug text-text-2">{h.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
