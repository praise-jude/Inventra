import { Clock, TrendingUp, ShieldAlert, Rocket } from "lucide-react";

const REASONS = [
  {
    icon: Clock,
    title: "Save Time",
    desc: "Automate stock counts, reorders, and reports so your team spends less time on spreadsheets.",
    gradient: "linear-gradient(135deg, var(--accent), var(--accent-2))",
  },
  {
    icon: TrendingUp,
    title: "Increase Profit",
    desc: "Spot your highest-margin products and cut the ones dragging your business down.",
    gradient: "linear-gradient(135deg, var(--teal), var(--green))",
  },
  {
    icon: ShieldAlert,
    title: "Prevent Stock Loss",
    desc: "Real-time alerts and audit trails catch shrinkage and stockouts before they hurt you.",
    gradient: "linear-gradient(135deg, var(--amber), var(--red))",
  },
  {
    icon: Rocket,
    title: "Grow Faster",
    desc: "Multi-branch, multi-user tools that scale with you from one shop to a full chain.",
    gradient: "linear-gradient(135deg, var(--accent-2), var(--sky))",
  },
];

export function WhyInventra() {
  return (
    <section className="bg-surface-2 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">Why Inventra</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-2">
            Built for the realities of running a business, not just managing spreadsheets.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map(({ icon: Icon, title, desc, gradient }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border-2 bg-surface p-6 transition-transform duration-300 hover:-translate-y-1.5"
            >
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-15 blur-xl transition-opacity duration-300 group-hover:opacity-30"
                style={{ background: gradient }}
              />
              <span
                className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-[var(--shadow-sm)]"
                style={{ background: gradient }}
              >
                <Icon size={22} />
              </span>
              <h3 className="relative mt-5 text-[17px] font-bold text-text">{title}</h3>
              <p className="relative mt-2 text-[13.5px] leading-relaxed text-text-2">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
