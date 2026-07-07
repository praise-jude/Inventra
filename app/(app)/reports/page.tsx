import { requireManagerProfile } from "@/lib/queries/session";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ReportsPage() {
  await requireManagerProfile();

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Reports</div>
        <div className="mt-[3px] text-text-2">Exportable reports across sales, inventory, and expenses.</div>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <EmptyState
          icon="📈"
          title="Custom reports are coming soon"
          description="Scheduled and exportable reports (sales, inventory valuation, profit & loss) are on our roadmap. For now, the Dashboard and Expenses pages cover the same underlying data."
          action={{ label: "Go to Dashboard", href: "/dashboard" }}
        />
      </div>
    </div>
  );
}
