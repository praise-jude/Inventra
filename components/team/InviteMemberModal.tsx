"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { inviteMember } from "@/lib/actions/team";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const ADMIN_ROLES_OPTIONS = ["admin", "manager", "cashier", "warehouse"];
// A Manager may only invite Staff — enforced again server-side in
// lib/team-service.ts's MANAGER_INVITABLE_ROLES, this just keeps the
// picker from offering a choice the server would reject.
const MANAGER_ROLES_OPTIONS = ["cashier", "warehouse"];

export function InviteMemberModal({
  warehouses,
  isAdmin,
  onClose,
}: {
  warehouses: { id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const ROLES = isAdmin ? ADMIN_ROLES_OPTIONS : MANAGER_ROLES_OPTIONS;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(isAdmin ? "manager" : "cashier");
  const [branchId, setBranchId] = useState(warehouses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string; branchId?: string }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: { firstName?: string; lastName?: string; email?: string; branchId?: string } = {};
    if (!firstName.trim()) errs.firstName = "First name is required.";
    if (!lastName.trim()) errs.lastName = "Last name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!branchId) errs.branchId = "Pick a branch.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await inviteMember(email, role, firstName, lastName, branchId);
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
              <Field
                label="First name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setFieldErrors((fe) => ({ ...fe, firstName: undefined }));
                }}
                required
                error={fieldErrors.firstName}
              />
            </div>
            <div className="flex-1">
              <Field
                label="Last name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setFieldErrors((fe) => ({ ...fe, lastName: undefined }));
                }}
                required
                error={fieldErrors.lastName}
              />
            </div>
          </div>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((fe) => ({ ...fe, email: undefined }));
            }}
            required
            error={fieldErrors.email}
          />
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
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Branch</label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setFieldErrors((fe) => ({ ...fe, branchId: undefined }));
              }}
              className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text"
            >
              {warehouses.length === 0 && <option value="">No branches yet</option>}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {fieldErrors.branchId && <p className="mt-1.5 text-[12px] font-medium text-red">{fieldErrors.branchId}</p>}
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
