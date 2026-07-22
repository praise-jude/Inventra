"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/billing-plans";
import { MotionStagger, fadeUpItem } from "./MotionSection";
import { motion } from "framer-motion";

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          Simple, honest pricing
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-text-2">
          Start free. Upgrade whenever you&rsquo;re ready — no hidden fees, cancel anytime.
        </p>
      </div>

      <MotionStagger className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.key}
            variants={fadeUpItem}
            className={`relative flex flex-col rounded-2xl border p-7 ${
              plan.highlight
                ? "border-accent bg-surface shadow-[var(--shadow-lg)] lg:-translate-y-3"
                : "border-border bg-surface shadow-[var(--shadow-sm)]"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-white shadow-[var(--shadow-sm)]">
                {plan.badge}
              </span>
            )}
            <h3 className="text-[16px] font-bold text-text">{plan.name}</h3>
            <p className="mt-1.5 text-[13px] text-text-2">{plan.desc}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-[34px] font-extrabold leading-none text-text">
                {plan.price === 0 ? "Free" : formatNaira(plan.price)}
              </span>
              {plan.interval && (
                <span className="pb-1 text-[13px] font-medium text-faint">/{plan.interval === "monthly" ? "mo" : "yr"}</span>
              )}
            </div>

            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-text-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-green" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className={`mt-7 inline-flex h-11 items-center justify-center rounded-[9px] text-[14px] font-semibold transition-[filter,transform] hover:-translate-y-0.5 ${
                plan.highlight
                  ? "bg-accent text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
                  : "border border-border bg-surface text-text hover:bg-hover"
              }`}
            >
              {plan.key === "trial" ? "Start Free Trial" : plan.cta}
            </Link>
          </motion.div>
        ))}
      </MotionStagger>
    </section>
  );
}
