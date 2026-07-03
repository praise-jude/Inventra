"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { inviteMember } from "@/lib/actions/team";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const ROLES = ["admin", "manager", "cashier", "warehouse"];

export function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const flash = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await inviteMember(email, role, firstName, lastName);
      flash("Invite sent");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-[440px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-bold">Invite member</div>
            <div className="text-[12.5px] text-muted">They&apos;ll get a real email to set their password.</div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="flex-1">
              <Field label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </form>
    </div>
  );
}
