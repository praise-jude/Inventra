"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { usePresence } from "@/components/app/PresenceProvider";
import { useToast } from "@/components/app/ToastProvider";
import { reactivateMember, removeMember, resendInvite, suspendMember, updateMemberRole } from "@/lib/actions/team";
import type { TeamMemberRow } from "@/lib/queries/team";

const InviteMemberModal = dynamic(() => import("@/components/team/InviteMemberModal").then((m) => m.InviteMemberModal));

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const ROLE_STYLE: Record<string, { color: string; background: string }> = {
  owner: { color: "var(--accent-text)", background: "var(--accent-weak)" },
  admin: { color: "var(--text-2)", background: "var(--hover)" },
  manager: { color: "var(--green)", background: "var(--green-weak)" },
  cashier: { color: "var(--amber)", background: "var(--amber-weak)" },
  warehouse: { color: "var(--sky)", background: "var(--sky-weak)" },
};

const ASSIGNABLE_ROLES = ["admin", "manager", "cashier", "warehouse"];

const GRADIENTS = [
  "linear-gradient(135deg,#635bff,#8a86ff)",
  "linear-gradient(135deg,#0e7cc4,#5cc0f5)",
  "linear-gradient(135deg,#12805c,#3ddc9a)",
  "linear-gradient(135deg,#b7791f,#f0b352)",
  "linear-gradient(135deg,#55607a,#8a94a8)",
];

const ROLE_LEGEND = [
  { role: "Owner", perms: "Full access · billing, delete workspace, all data" },
  { role: "Admin", perms: "Manage members, products, settings — no billing" },
  { role: "Manager", perms: "Products, inventory, purchase orders, reports" },
  { role: "Cashier", perms: "POS sales, returns, view own reports only" },
  { role: "Warehouse", perms: "Stock movements, receiving, transfers — no pricing" },
];

export function TeamClient({
  members,
  seatsUsed,
  seatsTotal,
  currentUserId,
}: {
  members: TeamMemberRow[];
  seatsUsed: number;
  seatsTotal: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const flash = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const { formatDateTime } = useWorkspace();
  const { online } = usePresence();
  const presenceById = useMemo(() => new Map(online.map((u) => [u.userId, u])), [online]);

  async function run(id: string, action: () => Promise<void>, successMessage: string) {
    setBusyId(id);
    setMenuOpenId(null);
    try {
      await action();
      flash(successMessage);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  function handleRoleChange(id: string, role: string) {
    run(id, () => updateMemberRole(id, role), "Role updated");
  }

  function handleSuspend(m: TeamMemberRow) {
    if (!window.confirm(`Suspend ${m.name}? They won't be able to sign in until reactivated.`)) return;
    run(m.id, () => suspendMember(m.id), "Member suspended");
  }

  function handleReactivate(m: TeamMemberRow) {
    run(m.id, () => reactivateMember(m.id), "Member reactivated");
  }

  function handleResendInvite(m: TeamMemberRow) {
    run(m.id, () => resendInvite(m.id), "Invite resent");
  }

  function handleRemove(m: TeamMemberRow) {
    if (!window.confirm(`Remove ${m.name} from the team? This can't be undone.`)) return;
    run(m.id, () => removeMember(m.id), "Member removed");
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Team Management</div>
          <div className="mt-[3px] text-text-2">
            {members.length} members · {seatsUsed} of {seatsTotal} seats used.
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="h-[37px] rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Invite member
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="scroll overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Member</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Role</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Status</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Last active</th>
                <th className="px-4 py-[11px]" />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const presence = presenceById.get(m.id);
                const isSelf = m.id === currentUserId;
                const isSuspended = !!m.suspendedAt;
                const isBusy = busyId === m.id;
                return (
                <tr key={m.id} className="border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-[11px]">
                      <div className="relative">
                        <div
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
                          style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                        >
                          {m.initials}
                        </div>
                        {m.status === "active" && !isSuspended && (
                          <span
                            title={presence ? (presence.status === "online" ? "Online" : "Idle") : "Offline"}
                            className="absolute -right-px -top-px h-[9px] w-[9px] rounded-full border-[1.5px] border-surface"
                            style={{ background: presence ? (presence.status === "online" ? "var(--green)" : "var(--amber)") : "var(--faint)" }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold">
                          {m.name} {isSelf && <span className="text-muted">(you)</span>}
                        </div>
                        <div className="text-[11.5px] text-muted">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    {m.role === "owner" || isSelf ? (
                      <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold capitalize" style={ROLE_STYLE[m.role]}>
                        {m.role}
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        disabled={isBusy}
                        className="rounded-[8px] border border-border bg-surface px-2 py-1 text-[12px] font-semibold capitalize text-text disabled:opacity-60"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r[0].toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold"
                      style={
                        isSuspended
                          ? { color: "var(--red)", background: "var(--red-weak)" }
                          : m.status === "active"
                            ? { color: "var(--green)", background: "var(--green-weak)" }
                            : { color: "var(--amber)", background: "var(--amber-weak)" }
                      }
                    >
                      {isSuspended ? "Suspended" : m.status === "active" ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">
                    {isSuspended
                      ? "—"
                      : m.status === "invited"
                        ? "Pending"
                        : presence
                          ? presence.status === "online"
                            ? "Online now"
                            : `Idle · since ${formatDateTime(presence.since)}`
                          : m.lastActive
                            ? timeAgo(m.lastActive)
                            : "—"}
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    {!isSelf && m.role !== "owner" && (
                      <>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                          disabled={isBusy}
                          className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-60"
                        >
                          {isBusy ? "…" : "Actions ⌄"}
                        </button>
                        {menuOpenId === m.id && (
                          <div className="absolute right-4 top-10 z-10 w-[180px] rounded-[10px] border border-border bg-surface py-1.5 text-left shadow-[var(--shadow-lg)]">
                            {m.status === "invited" && (
                              <button
                                onClick={() => handleResendInvite(m)}
                                className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                              >
                                Resend invite
                              </button>
                            )}
                            {isSuspended ? (
                              <button
                                onClick={() => handleReactivate(m)}
                                className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(m)}
                                className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(m)}
                              className="block w-full px-3.5 py-2 text-left text-[12.5px] text-red hover:bg-hover"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {ROLE_LEGEND.map((r) => (
          <div key={r.role} className="rounded-xl border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
            <div className="mb-1 text-[13.5px] font-bold">{r.role}</div>
            <div className="text-[12px] leading-relaxed text-text-2">{r.perms}</div>
          </div>
        ))}
      </div>

      {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
