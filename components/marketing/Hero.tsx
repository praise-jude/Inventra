"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PlayCircle, Package, TrendingUp, AlertTriangle, Boxes } from "lucide-react";
import { SalesBars, RevenueLine } from "./charts";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-blob absolute -left-32 -top-24 h-[420px] w-[420px] rounded-full opacity-40 blur-[100px]"
          style={{ background: "var(--teal)" }}
        />
        <div
          className="animate-blob absolute -right-24 top-10 h-[380px] w-[380px] rounded-full opacity-30 blur-[100px]"
          style={{ background: "var(--accent)", animationDelay: "-4s" }}
        />
        <div
          className="animate-blob absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full opacity-25 blur-[100px]"
          style={{ background: "var(--green)", animationDelay: "-8s" }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div
            variants={item}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-[13px] font-semibold text-text-2 shadow-[var(--shadow-sm)] backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            AI-powered inventory &amp; POS for SMEs
          </motion.div>

          <motion.h1
            variants={item}
            className="text-[40px] font-extrabold leading-[1.08] tracking-tight text-text sm:text-[52px] lg:text-[56px]"
          >
            Run Your Entire Business{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--teal), var(--accent))" }}
            >
              From One Dashboard
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-[17px] leading-relaxed text-text-2 sm:text-[18px]">
            Track inventory, manage sales, monitor stock, generate invoices, accept payments, and
            grow your business with Inventra.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-accent px-6 text-[15px] font-semibold text-white shadow-[var(--shadow)] transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-[1.06]"
            >
              Start Free Trial
              <ArrowRight size={17} />
            </Link>
            <a
              href="#dashboard"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] border border-border bg-surface px-6 text-[15px] font-semibold text-text transition-[background,transform] hover:-translate-y-0.5 hover:bg-hover"
            >
              <PlayCircle size={18} />
              Watch Demo
            </a>
          </motion.div>

          <motion.p variants={item} className="mt-7 text-[13px] text-faint">
            No credit card required &middot; Free 14-day trial &middot; Cancel anytime
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[560px]"
        >
          {/* Dashboard mockup */}
          <div className="relative rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-lg)] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                <span className="h-2.5 w-2.5 rounded-full bg-green" />
              </div>
              <span className="text-[11px] font-medium text-faint">inventra.app/dashboard</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-xl border border-border-2 bg-surface-2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Revenue this month</p>
                <p className="mt-1 text-[22px] font-extrabold text-text">₦4,286,900</p>
                <div className="mt-3 h-16 w-full">
                  <RevenueLine className="h-full w-full" />
                </div>
              </div>
              <div className="rounded-xl border border-border-2 bg-surface-2 p-4">
                <Boxes size={16} className="text-accent" />
                <p className="mt-2 text-[20px] font-extrabold text-text">1,284</p>
                <p className="text-[11px] font-medium text-faint">Products tracked</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-border-2 bg-surface-2 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Weekly sales</p>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-green">
                  <TrendingUp size={12} /> +18.4%
                </span>
              </div>
              <div className="h-20">
                <SalesBars />
              </div>
            </div>
          </div>

          {/* Floating card: low stock alert */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="animate-fade-in absolute -left-8 top-10 hidden w-[190px] rounded-xl border border-border bg-surface p-3.5 shadow-[var(--shadow-lg)] sm:block"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-weak text-amber">
                <AlertTriangle size={15} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-text">Low stock</p>
                <p className="text-[11px] text-faint">6 items need reorder</p>
              </div>
            </div>
          </motion.div>

          {/* Floating card: profit */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute -bottom-8 -right-6 hidden w-[176px] rounded-xl border border-border bg-surface p-3.5 shadow-[var(--shadow-lg)] sm:block"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-weak text-green">
                <Package size={15} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-text">Net profit</p>
                <p className="text-[13px] font-extrabold text-green">+₦912,400</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
