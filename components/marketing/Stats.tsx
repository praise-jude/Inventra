"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface Stat {
  value: number;
  suffix: string;
  label: string;
  prefix?: string;
  decimals?: number;
}

const STATS: Stat[] = [
  { value: 10000, suffix: "+", label: "Businesses" },
  { value: 2, suffix: " Million+", label: "Products Managed" },
  { value: 5, suffix: " Billion+", label: "Sales Tracked", prefix: "₦" },
  { value: 99.9, suffix: "%", label: "Uptime", decimals: 1 },
];

function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1600, bounce: 0 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString());
    });
    return unsub;
  }, [spring, decimals]);

  return <span ref={ref}>{display}</span>;
}

export function Stats() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-8 rounded-2xl border border-border bg-surface px-6 py-10 shadow-[var(--shadow-sm)] sm:px-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-[30px] font-extrabold tracking-tight text-text sm:text-[36px]">
                {s.prefix ?? ""}
                <Counter value={s.value} decimals={s.decimals} />
                {s.suffix}
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-text-2">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
