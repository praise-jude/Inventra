import { requireProfile } from "@/lib/queries/session";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotificationsPage() {
  await requireProfile();

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Notifications</div>
        <div className="mt-[3px] text-text-2">A full activity and alerts history for your organization.</div>
      </div>
      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <EmptyState
          icon="🔔"
          title="A full notifications inbox is coming soon"
          description="Live stock alerts are already available from the bell icon in the top bar. This page will collect a searchable history of every alert. Manage what you're notified about from Settings."
          action={{ label: "Notification settings", href: "/settings/notifications" }}
        />
      </div>
    </div>
  );
}
