"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, markAllNotificationsRead, type NotificationRow } from "@/lib/actions/notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const TYPE_ICON: Record<string, string> = {
  member_approved: "✅",
  member_rejected: "❌",
  pending_approval: "⏳",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Realtime (postgres_changes on notifications, filtered to this user) so a
// notification created by another session — e.g. a Manager approving
// someone from the mobile app — shows up here immediately, same intent as
// PresenceProvider's channel but for data instead of online status.
export function NotificationsClient({ initialNotifications, userId }: { initialNotifications: NotificationRow[]; userId: string }) {
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setNotifications((prev) => [
            {
              id: row.id as string,
              type: row.type as string,
              title: row.title as string,
              body: row.body as string | null,
              entityType: row.entity_type as string | null,
              entityId: row.entity_id as string | null,
              readAt: row.read_at as string | null,
              createdAt: row.created_at as string,
            },
            ...prev,
          ]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    await markNotificationRead(id);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Notifications</div>
          <div className="mt-[3px] text-text-2">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"} · live stock alerts are still in the
            bell icon above.
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        {notifications.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications yet" description="Approvals, rejections, and team activity will show up here." />
        ) : (
          <div className="divide-y divide-border-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.readAt && handleMarkRead(n.id)}
                className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-hover"
              >
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-accent-weak text-[15px]">
                  {TYPE_ICON[n.type] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{n.title}</span>
                    {!n.readAt && <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-accent" />}
                  </span>
                  {n.body && <span className="mt-0.5 block text-[12.5px] text-text-2">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
