"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelApprovalRequest } from "@/lib/actions/approvals";
import { Button } from "@/components/ui/Button";

// Realtime-subscribes to this one approval_requests row so the cashier sees
// the outcome the instant a manager decides, without polling — same
// postgres_changes pattern as NotificationsClient, scoped to a single id.
export function PendingApprovalWait({
  requestId,
  onApproved,
  onRejected,
  onCancelled,
}: {
  requestId: string;
  onApproved: (saleId: string | null) => void;
  onRejected: (reason: string | null) => void;
  onCancelled: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`approval-request:${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "approval_requests", filter: `id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const status = row.status as string;
          if (status === "approved") onApproved((row.entity_id as string) ?? null);
          else if (status === "rejected") onRejected(row.rejected_reason as string | null);
          else if (status === "cancelled") onCancelled();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelApprovalRequest(requestId);
      onCancelled();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,20,32,.5)]">
      <div className="w-[380px] max-w-[92vw] rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-lg)]">
        <div className="mx-auto mb-3.5 h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <div className="mb-1.5 text-[15px] font-bold">Waiting for manager approval</div>
        <p className="mb-4 text-[13px] text-text-2">
          This discount is above the store&apos;s approval threshold — a manager or admin needs to approve it before the sale is recorded.
        </p>
        <Button variant="secondary" onClick={handleCancel} disabled={cancelling} className="w-full">
          {cancelling ? "Cancelling…" : "Cancel request"}
        </Button>
      </div>
    </div>
  );
}
