"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#dashboard", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-[background,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-border bg-surface/80 shadow-[var(--shadow-sm)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8"
      >
        <Link href="/" className="flex items-center gap-2.5 font-bold text-text">
          <Image src="/inventra-logo.svg" alt="" width={28} height={28} priority className="h-7 w-7" />
          <span className="text-[17px] tracking-tight">Inventra</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium text-text-2 transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle initialTheme={initialTheme} />
          <Link
            href="/login"
            className="rounded-[9px] px-3.5 py-2 text-[14px] font-semibold text-text-2 transition-colors hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-[9px] bg-accent px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-sm)] transition-[filter] hover:brightness-[1.06]"
          >
            Start Free Trial
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle initialTheme={initialTheme} />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="animate-fade-in border-t border-border bg-surface px-5 pb-6 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-[15px] font-medium text-text-2 hover:bg-hover hover:text-text"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-[9px] border border-border bg-surface text-[14px] font-semibold text-text"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-[9px] bg-accent text-[14px] font-semibold text-white shadow-[var(--shadow-sm)]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
