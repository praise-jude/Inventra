"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Amara Chukwu",
    role: "Owner, Amara Fashion House",
    quote:
      "Inventra took us off spreadsheets in a week. Stock counts that used to take a whole day now take twenty minutes.",
    rating: 5,
  },
  {
    name: "Tunde Bakare",
    role: "Manager, QuickMart Supermarket",
    quote:
      "The low stock alerts alone paid for the subscription. We haven't run out of a top seller in three months.",
    rating: 5,
  },
  {
    name: "Ifeoma Nwosu",
    role: "Founder, Ifeoma Pharmacy",
    quote:
      "Multi-branch view is exactly what we needed. I can see all three locations from my phone during my commute.",
    rating: 5,
  },
  {
    name: "Daniel Osei",
    role: "Operations Lead, Osei Electronics",
    quote:
      "Barcode scanning and the offline POS mean we never stop selling, even when the network drops.",
    rating: 4,
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[index];

  return (
    <section className="bg-surface-2 py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
            Loved by business owners
          </h2>
          <p className="mt-4 text-[16px] text-text-2">Real results from teams running on Inventra.</p>
        </div>

        <div className="relative mt-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow)] sm:p-10">
            <Quote className="text-accent/25" size={36} aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="mt-2 text-[18px] leading-relaxed text-text sm:text-[20px]">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, var(--teal), var(--accent))" }}
                    aria-hidden="true"
                  >
                    {t.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-text">{t.name}</p>
                    <p className="text-[12.5px] text-faint">{t.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className={i < t.rating ? "fill-amber text-amber" : "text-border"} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={() => setIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-2 hover:bg-hover"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to testimonial ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className="h-2 rounded-full transition-[width,background]"
                  style={{ width: i === index ? 20 : 8, background: i === index ? "var(--accent)" : "var(--border)" }}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={() => setIndex((i) => (i + 1) % TESTIMONIALS.length)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-2 hover:bg-hover"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
