import { Sparkles, TrendingUp, Boxes, Lightbulb, LineChart, PackageSearch, MessageSquareText } from "lucide-react";
import { MotionSection } from "./MotionSection";

const AI_FEATURES = [
  { icon: TrendingUp, title: "Sales forecasting", desc: "Predict next week's demand from your actual sales history." },
  { icon: Boxes, title: "Inventory predictions", desc: "Know what will run out before it happens." },
  { icon: Lightbulb, title: "Business insights", desc: "Plain-language summaries of what's driving your numbers." },
  { icon: LineChart, title: "Profit recommendations", desc: "Get suggestions on pricing and slow-moving stock." },
  { icon: PackageSearch, title: "Demand forecasting", desc: "Plan purchasing around seasonal and local demand shifts." },
  { icon: MessageSquareText, title: "Natural language reports", desc: "Ask \"how did we do this month?\" and get a real answer." },
];

export function AISection() {
  return (
    <section className="relative isolate overflow-hidden py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(ellipse at 50% 0%, var(--teal-weak), transparent 60%)" }}
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <MotionSection className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-text">
            <Sparkles size={13} /> Powered by AI
          </span>
          <h2 className="mt-5 text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
            Smarter decisions, automatically
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-2">
            Inventra&rsquo;s AI watches your sales and stock so you can focus on running the business,
            not crunching numbers.
          </p>
        </MotionSection>

        <div className="mt-16 grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {AI_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-surface p-5">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "var(--teal-weak)", color: "var(--teal)" }}
                >
                  <Icon size={18} />
                </span>
                <h3 className="mt-3.5 text-[14.5px] font-bold text-text">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{desc}</p>
              </div>
            ))}
          </div>

          <MotionSection delay={0.1} className="relative mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                  style={{ background: "linear-gradient(135deg, var(--teal), var(--accent))" }}
                >
                  <Sparkles size={16} />
                </span>
                <p className="text-[13.5px] font-bold text-text">Inventra AI</p>
              </div>
              <div className="mt-5 rounded-xl bg-surface-2 p-4">
                <p className="text-[13px] leading-relaxed text-text-2">
                  &ldquo;Based on the last 8 weeks, restock <strong className="text-text">Peak Milk 400g</strong> by
                  Thursday — you&rsquo;ll likely sell out by the weekend based on current demand.&rdquo;
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Reorder 60 units", "Snooze", "View trend"].map((a, i) => (
                  <span
                    key={a}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: i === 0 ? "var(--accent)" : "var(--surface-2)",
                      color: i === 0 ? "#fff" : "var(--text-2)",
                      border: i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </MotionSection>
        </div>
      </div>
    </section>
  );
}
