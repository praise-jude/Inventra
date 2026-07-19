"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

// Re-runs the server component's status check (pending-approval/page.tsx
// redirects to /dashboard once status flips to active) without a full page
// reload and without touching the session — "check approval status
// without requiring logout".
export function RefreshApprovalButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.refresh()}>
      Refresh
    </Button>
  );
}
