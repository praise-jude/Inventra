import { requireProfile } from "@/lib/queries/session";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function PurchasesPage() {
  await requireProfile();

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Purchases</div>
        <div className="mt-[3px] text-text-2">Track purchase orders sent to your suppliers.</div>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <EmptyState
          icon="🛒"
          title="Purchase orders are coming soon"
          description="Create and track purchase orders to your suppliers, right alongside stock receiving. This is on our roadmap — in the meantime, receive stock directly from the Suppliers page."
          action={{ label: "Go to Suppliers", href: "/inventory/suppliers" }}
        />
      </div>
    </div>
  );
}
