"use client";

import { usePresence } from "@/components/app/PresenceProvider";
import type { TeamMemberRow } from "@/lib/queries/team";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  warehouse: "Warehouse",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function TeamPresenceCard({ members, showRoleBreakdown }: { members: TeamMemberRow[]; showRoleBreakdown: boolean }) {
  const { online } = usePresence();
  const onlineIds = new Set(online.map((u) => u.userId));
  const activeMembers = members.filter((m) => m.status === "active");
  const offline = activeMembers.filter((m) => !onlineIds.has(m.id));

  const onlineByRole = new Map<string, typeof online>();
  for (const u of online) {
    onlineByRole.set(u.role, [...(onlineByRole.get(u.role) ?? []), u]);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-[18px_20px] shadow-[var(--shadow-sm)]">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-bold">Team presence</div>
          <div className="text-[12.5px] text-muted">Who&apos;s active right now</div>
        </div>
        <div className="flex gap-3.5 text-right">
          <div>
            <div className="font-mono text-[19px] font-bold" style={{ color: "var(--green)" }}>{online.length}</div>
            <div className="text-[11px] text-muted">online</div>
          </div>
          <div>
            <div className="font-mono text-[19px] font-bold text-muted">{offline.length}</div>
            <div className="text-[11px] text-muted">offline</div>
          </div>
        </div>
      </div>

      {online.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nobody else is online right now.</p>
      ) : showRoleBreakdown ? (
        <div className="flex flex-col gap-3">
          {[...onlineByRole.entries()].map(([role, users]) => (
            <div key={role}>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
                {ROLE_LABEL[role] ?? role} · {users.length}
              </div>
              <div className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <div key={u.userId} className="flex items-center gap-2 text-[12.5px]">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ background: u.status === "online" ? "var(--green)" : "var(--amber)" }}
                    />
                    <span className="flex-1 truncate">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {online.map((u) => (
            <div key={u.userId} className="flex items-center gap-2 text-[12.5px]">
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: u.status === "online" ? "var(--green)" : "var(--amber)" }}
              />
              <span className="flex-1 truncate">{u.name}</span>
            </div>
          ))}
        </div>
      )}

      {showRoleBreakdown && offline.length > 0 && (
        <div className="mt-3.5 border-t border-border-2 pt-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted">Last seen</div>
          <div className="flex flex-col gap-1.5">
            {offline.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-[12.5px]">
                <span className="truncate text-text-2">{m.name}</span>
                <span className="flex-shrink-0 text-muted">{m.lastActive ? timeAgo(m.lastActive) : "never"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
