"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { inviteBranchStaff } from "@/lib/actions/branch-staff";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const ADMIN_ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "warehouse", label: "Warehouse" },
];
// A Manager may only invite Staff — enforced again server-side in
// lib/branch-staff-service.ts's MANAGER_INVITABLE_ROLES, this just keeps
// the picker from offering a choice the server would reject.
const MANAGER_ROLE_OPTIONS = [
  { value: "cashier", label: "Cashier" },
  { value: "warehouse", label: "Warehouse" },
];

export function InviteStaffModal({
  branchId,
  branchName,
  isAdmin,
  onClose,
}: {
  branchId: string;
  branchName: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const roleOptions = isAdmin ? ADMIN_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS;
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: roleOptions[0].value });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setError("Fill in every field before sending the invite.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await inviteBranchStaff({ email: form.email.trim(), role: form.role, firstName: form.firstName.trim(), lastName: form.lastName.trim(), branchId });
      flash("Invite sent");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-[440px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">Invite staff to {branchName}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <Field label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            <Field label="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <Select label="Role" value={form.role} onChange={(e) => set("role", e.target.value)}>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
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
