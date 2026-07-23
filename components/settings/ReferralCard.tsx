"use client";

import { useState } from "react";
import { useToast } from "@/components/app/ToastProvider";

interface ReferredOrg {
  id: string;
  name: string;
  created_at: string;
}

// Track-only for now (no reward mechanics) — just makes the org's own code
// visible/shareable and shows who's signed up using it.
export function ReferralCard({ code, referredOrgs }: { code: string; referredOrgs: ReferredOrg[] }) {
  const flash = useToast();
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${code}` : `/signup?ref=${code}`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      flash(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flash("Could not copy — copy it manually.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-1 text-[15px] font-bold">Referral code</div>
      <div className="mb-4 text-[12.5px] text-text-2">
        Share your code or link — businesses that sign up with it are linked to your organization here.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Your code</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px] font-mono text-[14px] tracking-wider text-text">
              {code}
            </div>
            <button
              type="button"
              onClick={() => copy(code, "Code")}
              className="h-[42px] flex-shrink-0 rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Shareable link</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px] text-[13px] text-text-2">
              {link}
            </div>
            <button
              type="button"
              onClick={() => copy(link, "Link")}
              className="h-[42px] flex-shrink-0 rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4.5">
        <div className="mb-2 text-[12.5px] font-semibold text-text-2">
          Businesses referred by you {referredOrgs.length > 0 && `(${referredOrgs.length})`}
        </div>
        {referredOrgs.length === 0 ? (
          <p className="text-[12.5px] text-muted">No signups with your code yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {referredOrgs.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-[13px]">
                <span className="text-text">{r.name}</span>
                <span className="text-[12px] text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
