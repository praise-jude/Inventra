import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";

export function CTA() {
  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden px-5 py-20 sm:px-8">
      <div className="relative isolate overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-16 sm:py-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(120deg, var(--teal), var(--accent-2))" }}
        />
        <div
          aria-hidden="true"
          className="animate-blob pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="animate-blob pointer-events-none absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />

        <h2 className="mx-auto max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight text-white sm:text-[42px]">
          Ready to Grow Your Business?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-white/85">
          Join thousands of businesses already running smarter with Inventra. Get started in
          minutes — no credit card required.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-white px-6 text-[15px] font-bold shadow-[var(--shadow-lg)] transition-transform hover:-translate-y-0.5"
            style={{ color: "#0f766e" }}
          >
            Start Free Trial
            <ArrowRight size={17} />
          </Link>
          <a
            href="#dashboard"
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] border border-white/30 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur transition-transform hover:-translate-y-0.5"
          >
            <CalendarCheck size={17} />
            Book Demo
          </a>
        </div>
      </div>
    </section>
  );
}
