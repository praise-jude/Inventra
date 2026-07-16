"use client";

import { useState } from "react";
import { REJECT_REASONS } from "@/lib/actions/team";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function RejectMemberModal({
  name,
  onConfirm,
  onClose,
}: {
  name: string;
  onConfirm: (reason: (typeof REJECT_REASONS)[number], detail?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number]>(REJECT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(reason, detail);
    setSaving(false);
  }

  return (
    <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[420px] rounded-2xl border border-border bg-surface p-[22px] shadow-[var(--shadow-lg)]"
      >
        <div className="text-[16px] font-bold">Reject {name}?</div>
        <p className="mt-1.5 text-[13px] text-text-2">
          They won&apos;t be able to log in until another invitation is issued.
        </p>
        <div className="mt-3.5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REJECT_REASONS)[number])}
            className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text"
          >
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {reason === "Other" && (
          <div className="mt-3">
            <Field label="Details" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving} className="border-none bg-red text-white">
            {saving ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}
