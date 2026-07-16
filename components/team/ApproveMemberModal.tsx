"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ApproveMemberModal({
  name,
  onConfirm,
  onClose,
}: {
  name: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    await onConfirm();
    setSaving(false);
  }

  return (
    <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[400px] rounded-2xl border border-border bg-surface p-[22px] shadow-[var(--shadow-lg)]"
      >
        <div className="text-[16px] font-bold">Approve {name}?</div>
        <p className="mt-1.5 text-[13px] text-text-2">
          Approve this team member and grant access to the assigned branch?
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}
