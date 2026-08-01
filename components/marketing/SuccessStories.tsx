"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { MotionSection, MotionStagger, fadeUpItem } from "./MotionSection";

interface StoryCard {
  industry: string;
  before: string[];
  after: string[];
}

// Illustrative before/after patterns, not a specific customer's measured
// result — same disclosure approach as Testimonials.tsx, no invented
// percentages (there's no real case-study data to cite yet).
const STORIES: StoryCard[] = [
  {
    industry: "Retail Business",
    before: ["Manual records", "Frequent stock shortages", "Slow checkout"],
    after: ["Real-time inventory", "Faster checkout", "Fewer stockouts"],
  },
  {
    industry: "Pharmacy",
    before: ["Expired medicines going unnoticed", "Manual inventory counts"],
    after: ["Expiry alerts", "AI reorder suggestions", "Fewer stockouts"],
  },
];

export function SuccessStories() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <MotionSection className="text-center">
          <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">What changes when you switch</h2>
          <p className="mt-4 text-[16px] text-text-2">Common before/after patterns businesses see after adopting Inventra.</p>
          <p className="mt-1 text-[12px] text-faint">Illustrative examples — not a specific customer&apos;s measured result.</p>
        </MotionSection>

        <MotionStagger className="mt-12 grid gap-6 sm:grid-cols-2">
          {STORIES.map((s) => (
            <motion.div
              key={s.industry}
              variants={fadeUpItem}
              className="rounded-2xl border border-border bg-surface/70 p-6 shadow-[var(--shadow-sm)] backdrop-blur transition-shadow duration-300 hover:shadow-lg sm:p-8"
            >
              <h3 className="text-[16px] font-bold text-text">{s.industry}</h3>
              <div className="mt-5 grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Before</p>
                  <ul className="mt-2.5 space-y-2">
                    {s.before.map((b) => (
                      <li key={b} className="flex items-start gap-1.5 text-[13px] text-text-2">
                        <XCircle size={14} className="mt-0.5 shrink-0 text-red" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">After</p>
                  <ul className="mt-2.5 space-y-2">
                    {s.after.map((a) => (
                      <li key={a} className="flex items-start gap-1.5 text-[13px] text-text-2">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
