import Link from "next/link";

// Minimal placeholder for a page-level Premium lock — Phase F7 replaces
// this with the full Upgrade modal experience (title/message/buttons per
// spec). Used wherever a whole page (not just one button) requires
// Premium, e.g. Reports, Audit Log, Integrations, API Keys.
export function PremiumLockedState({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-8 py-16 text-center">
      <span className="mb-3 rounded-full bg-accent-weak px-3 py-1 text-[11px] font-bold text-accent-text">PREMIUM</span>
      <h2 className="text-[18px] font-bold text-text">Upgrade to Inventra Premium</h2>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-text-2">
        {feature} is a Premium feature. Unlock unlimited inventory, receipt printing, inventory editing, reports, AI
        tools, team collaboration, analytics, and more by upgrading your subscription.
      </p>
      <Link
        href="/billing"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-[9px] bg-accent px-5 text-[13.5px] font-semibold text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
      >
        Upgrade Now
      </Link>
    </div>
  );
}
