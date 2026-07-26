import Link from "next/link";

// Per spec: shown on the Dashboard when the org is on the Free plan.
export function FreePlanBanner() {
  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
      style={{ background: "linear-gradient(120deg,var(--accent-weak),transparent)" }}
    >
      <div className="max-w-xl text-[13px] leading-snug text-text-2">
        <span className="font-bold text-text">You&apos;re currently using the Free Plan.</span> Upgrade to Premium to
        unlock unlimited inventory, receipt printing, reports, AI, and advanced business tools.
      </div>
      <Link
        href="/billing"
        className="flex h-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
      >
        Upgrade
      </Link>
    </div>
  );
}
