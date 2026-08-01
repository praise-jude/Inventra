"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { usePresence } from "@/components/app/PresenceProvider";
import { useToast } from "@/components/app/ToastProvider";
import { useEntitlementsContext } from "@/components/billing/EntitlementsProvider";
import {
  approveMember,
  rejectMember,
  reactivateMember,
  removeMember,
  resendInvite,
  suspendMember,
  updateMemberRole,
} from "@/lib/actions/team";
import type { REJECT_REASONS } from "@/lib/constants/team";
import type { TeamMemberRow, TeamSummary } from "@/lib/queries/team";
import { Table, type TableColumn } from "@/components/ui/Table";

const InviteMemberModal = dynamic(() => import("@/components/team/InviteMemberModal").then((m) => m.InviteMemberModal));
const ApproveMemberModal = dynamic(() => import("@/components/team/ApproveMemberModal").then((m) => m.ApproveMemberModal));
const RejectMemberModal = dynamic(() => import("@/components/team/RejectMemberModal").then((m) => m.RejectMemberModal));

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

// Five distinct colors using only tokens the design system already has —
// amber (Invited) and sky (Awaiting Approval) stand in for "orange" and
// "yellow" respectively, since the palette doesn't carry a separate yellow.
const STATUS_STYLE: Record<string, { label: string; color: string; background: string }> = {
  invited: { label: "Invited", color: "var(--amber)", background: "var(--amber-weak)" },
  awaiting_approval: { label: "Awaiting approval", color: "var(--sky)", background: "var(--sky-weak)" },
  active: { label: "Approved", color: "var(--green)", background: "var(--green-weak)" },
  rejected: { label: "Rejected", color: "var(--red)", background: "var(--red-weak)" },
  suspended: { label: "Suspended", color: "var(--muted)", background: "var(--hover)" },
};

const ASSIGNABLE_ROLES = ["admin", "manager", "cashier", "warehouse"];

const GRADIENTS = [
  "linear-gradient(135deg,#2563eb,#6366f1)",
  "linear-gradient(135deg,#0891b2,#22d3ee)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#55607a,#8a94a8)",
];

const ROLE_LEGEND = [
  { role: "Owner", perms: "Full access · billing, delete workspace, all data" },
  { role: "Admin", perms: "Manage members, products, settings — no billing" },
  { role: "Manager", perms: "Products, inventory, purchase orders, reports" },
  { role: "Cashier", perms: "POS sales, returns, view own reports only" },
  { role: "Warehouse", perms: "Stock movements, receiving, transfers — no pricing" },
];

const STATUS_KEYS = ["all", "invited", "awaiting_approval", "active", "suspended", "rejected"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

interface TeamFiltersState {
  q: string;
  status: string;
}

export function TeamClient({
  rows,
  total,
  page,
  pageSize,
  summary,
  seatsUsed,
  seatsTotal,
  currentUserId,
  orgId,
  warehouses,
  isAdmin,
  filters,
}: {
  rows: TeamMemberRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: TeamSummary;
  seatsUsed: number;
  seatsTotal: number;
  currentUserId: string;
  orgId: string;
  warehouses: { id: string; name: string }[];
  // Managers can reach this page too (see app/(app)/team/page.tsx) but only
  // to invite Staff and approve/reject awaiting_approval members — role
  // changes, suspend/reactivate, resend invite, and remove stay Admin-only,
  // enforced here (UI) and again server-side (lib/actions/team.ts +
  // guard_profile_status_transitions() RLS trigger).
  isAdmin: boolean;
  filters: TeamFiltersState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flash = useToast();
  const { isPremium, openUpgradeModal } = useEntitlementsContext();

  // Live sync: another session (a Manager approving someone from mobile,
  // an Admin changing a role from a different tab) updates this table
  // without the local actor doing anything — router.refresh() re-runs the
  // page's server-side getTeamMembersPage()/getTeamSummary() so the row
  // data here stays honest, same "postgres_changes filtered to this org"
  // pattern as the notifications feed.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`team:org:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `org_id=eq.${orgId}` }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<TeamMemberRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TeamMemberRow | null>(null);
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { formatDateTime } = useWorkspace();
  const { online } = usePresence();
  const presenceById = useMemo(() => new Map(online.map((u) => [u.userId, u])), [online]);

  const statusFilter: StatusKey = (STATUS_KEYS.find((k) => k === filters.status) ?? "all") as StatusKey;

  function pushParams(next: Partial<TeamFiltersState & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search === filters.q) return;
    debounceRef.current = setTimeout(() => pushParams({ q: search }), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const run = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string) => {
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
    },
    [flash, router],
  );

  // Mirrors the display precedence already used by the status badge/cards:
  // rejected_at and suspended_at override `status` for display purposes.
  function displayStatus(m: TeamMemberRow): "invited" | "awaiting_approval" | "active" | "suspended" | "rejected" {
    if (m.rejectedAt) return "rejected";
    if (m.suspendedAt) return "suspended";
    return m.status as "invited" | "awaiting_approval" | "active";
  }

  const handleRoleChange = useCallback((id: string, role: string) => run(id, () => updateMemberRole(id, role), "Role updated"), [run]);

  const handleSuspend = useCallback(
    (m: TeamMemberRow) => {
      if (!window.confirm(`Suspend ${m.name}? They won't be able to sign in until reactivated.`)) return;
      run(m.id, () => suspendMember(m.id), "Member suspended");
    },
    [run],
  );

  const handleReactivate = useCallback((m: TeamMemberRow) => run(m.id, () => reactivateMember(m.id), "Member reactivated"), [run]);

  const handleResendInvite = useCallback((m: TeamMemberRow) => run(m.id, () => resendInvite(m.id), "Invite resent"), [run]);

  const handleApprove = useCallback(async () => {
    if (!approveTarget) return;
    await run(approveTarget.id, () => approveMember(approveTarget.id), "Team member approved successfully.");
    setApproveTarget(null);
  }, [approveTarget, run]);

  const handleReject = useCallback(
    async (reason: (typeof REJECT_REASONS)[number], detail?: string) => {
      if (!rejectTarget) return;
      await run(rejectTarget.id, () => rejectMember(rejectTarget.id, reason, detail), "Member rejected");
      setRejectTarget(null);
    },
    [rejectTarget, run],
  );

  const handleRemove = useCallback(
    (m: TeamMemberRow) => {
      if (!window.confirm(`Remove ${m.name} from the team? This can't be undone.`)) return;
      run(m.id, () => removeMember(m.id), "Member removed");
    },
    [run],
  );

  const gradientIndex = useMemo(() => new Map(rows.map((m, i) => [m.id, i])), [rows]);

  const columns: TableColumn<TeamMemberRow>[] = useMemo(() => [
    {
      key: "member",
      header: "Member",
      render: (m) => {
        const presence = presenceById.get(m.id);
        const isSelf = m.id === currentUserId;
        const isSuspended = !!m.suspendedAt;
        return (
          <div className="flex items-center gap-[11px]">
            <div className="relative">
              <div
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[12.5px] font-bold text-white"
                style={{ background: GRADIENTS[(gradientIndex.get(m.id) ?? 0) % GRADIENTS.length] }}
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
        );
      },
    },
    {
      key: "role",
      header: "Role",
      render: (m) => {
        const isSelf = m.id === currentUserId;
        const isBusy = busyId === m.id;
        return m.role === "owner" || isSelf || !isAdmin ? (
          <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold capitalize" style={ROLE_STYLE[m.role]}>
            {m.role}
          </span>
        ) : (
          <select
            value={m.role}
            onChange={(e) => handleRoleChange(m.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={isBusy}
            className="rounded-[8px] border border-border bg-surface px-2 py-1 text-[12px] font-semibold capitalize text-text disabled:opacity-60"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "branch",
      header: "Branch",
      render: (m) => <span className="text-[12.5px] text-text-2">{m.branchName ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (m) => {
        const status = displayStatus(m);
        const style = STATUS_STYLE[status];
        return (
          <div>
            <span className="rounded-[20px] px-[9px] py-0.5 text-[11.5px] font-bold" style={style}>
              {style.label}
            </span>
            {status === "awaiting_approval" && m.acceptedAt && (
              <div className="mt-1 text-[10.5px] text-muted">Waiting {timeAgo(m.acceptedAt)}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (m) => {
        const presence = presenceById.get(m.id);
        const status = displayStatus(m);
        return (
          <span className="text-[12.5px] text-text-2">
            {status === "suspended" || status === "rejected"
              ? "—"
              : status === "invited" || status === "awaiting_approval"
                ? "Pending"
                : presence
                  ? presence.status === "online"
                    ? "Online now"
                    : `Idle · since ${formatDateTime(presence.since)}`
                  : m.lastActive
                    ? timeAgo(m.lastActive)
                    : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      hideable: false,
      align: "right",
      render: (m) => {
        const isSelf = m.id === currentUserId;
        const isBusy = busyId === m.id;
        const status = displayStatus(m);
        if (isSelf || m.role === "owner") return null;
        // Managers only get a menu at all for rows they can actually act on
        // (approve/reject) — same restriction enforced server-side by
        // guard_profile_status_transitions().
        if (!isAdmin && status !== "awaiting_approval") return null;
        return (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
              disabled={isBusy}
              className="h-7 rounded-[7px] border border-border bg-surface px-2.5 text-[12px] font-semibold text-text hover:bg-hover disabled:opacity-60"
            >
              {isBusy ? "…" : "Actions ⌄"}
            </button>
            {menuOpenId === m.id && (
              <div className="absolute right-0 top-8 z-10 w-[180px] rounded-[10px] border border-border bg-surface py-1.5 text-left shadow-[var(--shadow-lg)]">
                {isAdmin && status === "invited" && (
                  <button
                    onClick={() => handleResendInvite(m)}
                    className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                  >
                    Resend invite
                  </button>
                )}
                {status === "awaiting_approval" && (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setApproveTarget(m);
                      }}
                      className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        setRejectTarget(m);
                      }}
                      className="block w-full px-3.5 py-2 text-left text-[12.5px] text-red hover:bg-hover"
                    >
                      ❌ Reject
                    </button>
                  </>
                )}
                {isAdmin && status === "suspended" && (
                  <button
                    onClick={() => handleReactivate(m)}
                    className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                  >
                    Reactivate
                  </button>
                )}
                {isAdmin && status === "active" && (
                  <button
                    onClick={() => handleSuspend(m)}
                    className="block w-full px-3.5 py-2 text-left text-[12.5px] text-text hover:bg-hover"
                  >
                    Suspend
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => handleRemove(m)} className="block w-full px-3.5 py-2 text-left text-[12.5px] text-red hover:bg-hover">
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        );
      },
    },
  ], [presenceById, currentUserId, busyId, menuOpenId, formatDateTime, gradientIndex, handleRoleChange, handleSuspend, handleReactivate, handleResendInvite, handleRemove, isAdmin]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[22px] font-bold tracking-tight">Team Management</div>
          <div className="mt-[3px] text-text-2">
            {seatsUsed} members · {seatsUsed} of {seatsTotal} seats used.
          </div>
        </div>
        <button
          onClick={() => (isPremium ? setShowInvite(true) : openUpgradeModal())}
          className="flex h-[37px] items-center gap-1.5 rounded-[9px] bg-accent px-[15px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Invite member
          {!isPremium && <span className="rounded-full bg-white/25 px-1.5 py-px text-[9.5px] font-bold">PRO</span>}
        </button>
      </div>

      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))" }}>
        {(
          [
            ["all", "Total", summary.total],
            ["invited", "Invited", summary.invited],
            ["awaiting_approval", "Awaiting approval", summary.awaitingApproval],
            ["active", "Approved", summary.active],
            ["suspended", "Suspended", summary.suspended],
            ["rejected", "Rejected", summary.rejected],
          ] as const
        ).map(([key, label, count]) => {
          const active = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => pushParams({ status: key })}
              className="rounded-xl border p-[12px_14px] text-left shadow-[var(--shadow-sm)]"
              style={active ? { borderColor: "var(--accent)", background: "var(--accent-weak)" } : { borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="text-[20px] font-bold">{count}</div>
              <div className="text-[11.5px] text-text-2">{label}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-3.5 flex h-[37px] max-w-[360px] items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-muted">
        <span>⌕</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 border-none bg-transparent text-[13px] text-text outline-none"
        />
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        pageSize={Math.max(pageSize, rows.length)}
      />

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            Page {page} of {pageCount} · {total} total
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => pushParams({ page: page - 1 })}
              disabled={page <= 1}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => pushParams({ page: page + 1 })}
              disabled={page >= pageCount}
              className="flex h-8 items-center justify-center rounded-[7px] border border-border bg-surface px-3 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-hover"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {ROLE_LEGEND.map((r) => (
          <div key={r.role} className="rounded-xl border border-border bg-surface p-[14px_15px] shadow-[var(--shadow-sm)]">
            <div className="mb-1 text-[13.5px] font-bold">{r.role}</div>
            <div className="text-[12px] leading-relaxed text-text-2">{r.perms}</div>
          </div>
        ))}
      </div>

      {showInvite && <InviteMemberModal warehouses={warehouses} isAdmin={isAdmin} onClose={() => setShowInvite(false)} />}
      {approveTarget && (
        <ApproveMemberModal name={approveTarget.name} onConfirm={handleApprove} onClose={() => setApproveTarget(null)} />
      )}
      {rejectTarget && (
        <RejectMemberModal name={rejectTarget.name} onConfirm={handleReject} onClose={() => setRejectTarget(null)} />
      )}
    </div>
  );
}
