"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { ShieldCheck, RefreshCw, Building2, CloudCheck } from "lucide-react";
import type { PublicPlatformStats } from "@/lib/queries/platform-stats";
import { MotionSection, MotionStagger, fadeUpItem } from "./MotionSection";

// Deliberately qualitative, not fabricated numbers — a product at this
// stage doesn't have "10,000+ businesses" to cite honestly, and inventing
// a number would be exactly the kind of claim this page shouldn't make.
const HIGHLIGHTS = [
  { icon: ShieldCheck, label: "Bank-level encryption" },
  { icon: RefreshCw, label: "Real-time sync across web & mobile" },
  { icon: Building2, label: "Built for multi-branch businesses" },
  { icon: CloudCheck, label: "Secure cloud infrastructure" },
];

// Rounds down to a clean step once the number is large enough that exact
// precision would look like a suspiciously specific claim, but leaves
// small real numbers (early growth) exactly as they are rather than
// rounding something like "3" down to "0".
function roundedFloor(n: number): number {
  if (n < 20) return n;
  if (n < 100) return Math.floor(n / 10) * 10;
  if (n < 1000) return Math.floor(n / 50) * 50;
  return Math.floor(n / 100) * 100;
}

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1600, bounce: 0 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v).toLocaleString()));
    return unsub;
  }, [spring]);

  return <span ref={ref}>{display}</span>;
}

export function Stats({ stats }: { stats: PublicPlatformStats }) {
  const counters = [
    { value: stats.businesses, label: "Businesses using Inventra" },
    { value: stats.productsManaged, label: "Products managed" },
    { value: stats.salesProcessed, label: "Sales processed" },
    { value: stats.invoicesGenerated, label: "Invoices generated" },
    { value: stats.warehousesConnected, label: "Branches connected" },
    { value: stats.countriesReached, label: "Countries reached" },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <MotionSection>
          <MotionStagger className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-surface/70 px-6 py-10 shadow-[var(--shadow-sm)] backdrop-blur sm:px-10 lg:grid-cols-3">
            {counters.map((c) => (
              <motion.div key={c.label} variants={fadeUpItem} className="text-center">
                <p className="text-[28px] font-extrabold tracking-tight text-text sm:text-[34px]">
                  <Counter value={roundedFloor(c.value)} />+
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium text-text-2">{c.label}</p>
              </motion.div>
            ))}
          </MotionStagger>
        </MotionSection>

        <MotionSection delay={0.1} className="mt-6 grid grid-cols-2 gap-6 rounded-2xl border border-border bg-surface px-6 py-10 shadow-[var(--shadow-sm)] sm:px-10 lg:grid-cols-4">
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
        </MotionSection>
      </div>
    </section>
  );
}
