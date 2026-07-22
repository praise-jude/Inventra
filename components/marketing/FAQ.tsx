"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "How much does Inventra cost?",
    a: "Every account starts with a free 6-day trial with full access to every feature. After that, choose a monthly or yearly plan — yearly saves you two months compared to paying monthly. No hidden fees.",
  },
  {
    q: "Does Inventra work offline?",
    a: "Yes. The POS and inventory app keep working without an internet connection, queueing sales and stock changes locally, then syncing automatically the moment you're back online.",
  },
  {
    q: "Is my data backed up and synced to the cloud?",
    a: "All your data is securely stored in the cloud and synced in real time across every device and branch, so you always have an up-to-date, recoverable record of your business.",
  },
  {
    q: "How secure is my business data?",
    a: "Inventra uses encrypted sessions, optional multi-factor authentication, and role-based access control so staff only see what they need to. Every sensitive action is logged in an audit trail.",
  },
  {
    q: "Can I manage more than one branch or location?",
    a: "Yes. Multi-branch support lets you track inventory, sales, and staff separately per location while viewing consolidated reports across your whole business from one account.",
  },
  {
    q: "What kind of support do I get?",
    a: "Every plan includes email and in-app support. We're also happy to walk your team through setup on a live demo call before or after you sign up.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <div className="text-center">
        <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-[16px] text-text-2">Everything you need to know before you get started.</p>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[14.5px] font-semibold text-text">{f.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 text-faint"
                >
                  <ChevronDown size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    role="region"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-text-2">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
