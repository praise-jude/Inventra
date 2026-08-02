"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  Building2,
  CloudCheck,
  Package,
  ShoppingCart,
  Receipt,
  Warehouse,
  Globe,
  Smartphone,
} from "lucide-react";
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

// Compact K/M formatting for once real usage grows past four digits — the
// same numbers just read better at scale, no new claim implied.
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1800, bounce: 0 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(formatCompact(v)));
    return unsub;
  }, [spring]);

  return <span ref={ref}>{display}</span>;
}

export function Stats({ stats }: { stats: PublicPlatformStats }) {
  const counters = [
    { icon: Building2, value: stats.businesses, label: "Businesses using Inventra" },
    { icon: Package, value: stats.productsManaged, label: "Products managed" },
    { icon: ShoppingCart, value: stats.salesProcessed, label: "Sales processed" },
    { icon: Receipt, value: stats.invoicesGenerated, label: "Invoices generated" },
    { icon: Warehouse, value: stats.warehousesConnected, label: "Branches connected" },
    { icon: Globe, value: stats.countriesReached, label: "Countries reached" },
    { icon: Smartphone, value: stats.androidDownloads, label: "Android downloads" },
  ];

  return (
    <section className="relative overflow-hidden py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, var(--accent-weak), transparent 60%)" }}
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <MotionSection className="text-center">
          <h2 className="text-[26px] font-extrabold tracking-tight text-text sm:text-[32px]">
            Trusted by growing businesses
          </h2>
          <p className="mt-2 text-[14px] text-text-2">Real numbers, updated automatically as Inventra grows.</p>
        </MotionSection>

        <MotionStagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {counters.map((c) => (
            <motion.div
              key={c.label}
              variants={fadeUpItem}
              className="group rounded-2xl border border-border bg-surface/60 p-5 text-center shadow-[var(--shadow-sm)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-lg)] sm:p-6"
            >
              <span
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: "var(--accent-weak)", color: "var(--accent-text)" }}
              >
                <c.icon size={18} />
              </span>
              <p className="mt-3.5 text-[26px] font-extrabold tracking-tight text-text sm:text-[30px]">
                <Counter value={roundedFloor(c.value)} />+
              </p>
              <p className="mt-1 text-[12px] font-medium text-text-2">{c.label}</p>
            </motion.div>
          ))}
        </MotionStagger>

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
