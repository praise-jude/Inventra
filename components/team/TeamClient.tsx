"use client";

import { useState } from "react";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import type { TeamMemberRow } from "@/lib/queries/team";

const ROLE_STYLE: Record<string, { color: string; background: string }> = {
  owner: { color: "var(--accent-text)", background: "var(--accent-weak)" },
  admin: { color: "var(--text-2)", background: "var(--hover)" },
  manager: { color: "var(--green)", background: "var(--green-weak)" },
  cashier: { color: "var(--amber)", background: "var(--amber-weak)" },
  warehouse: { color: "var(--sky)", background: "var(--sky-weak)" },
};

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

export function TeamClient({ members, seatsUsed, seatsTotal }: { members: TeamMemberRow[]; seatsUsed: number; seatsTotal: number }) {
  const [showInvite, setShowInvite] = useState(false);
  const { formatDateTime } = useWorkspace();

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Team &amp; roles</div>
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
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Member</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Role</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Status</th>
                <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Last active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} className="border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-[11px]">
                      <div
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
                        style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                      >
                        {m.initials}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold">{m.name}</div>
                        <div className="text-[11.5px] text-muted">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold capitalize" style={ROLE_STYLE[m.role]}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold"
                      style={
                        m.status === "active"
                          ? { color: "var(--green)", background: "var(--green-weak)" }
                          : { color: "var(--amber)", background: "var(--amber-weak)" }
                      }
                    >
                      {m.status === "active" ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">
                    {m.status === "invited" ? "Pending" : m.lastActive ? formatDateTime(m.lastActive) : "—"}
                  </td>
                </tr>
              ))}
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
