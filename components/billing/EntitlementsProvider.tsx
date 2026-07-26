"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Entitlements } from "@/lib/entitlements";

interface EntitlementsContextValue {
  entitlements: Entitlements;
  isPremium: boolean;
  openUpgradeModal: () => void;
}

const EntitlementsContext = createContext<EntitlementsContextValue | undefined>(undefined);

// Fed the server-fetched snapshot once (app/(app)/layout.tsx calls
// lib/entitlements.ts's getEntitlements() and passes it down as a prop —
// same "Server Component fetches, Client Component renders" split as
// WorkspaceProvider/PresenceProvider already use in this app) so every
// client component in the tree can read tier/usage and trigger the
// Upgrade modal without prop-drilling through every intermediate layer.
export function EntitlementsProvider({ entitlements, children }: { entitlements: Entitlements; children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  // Phase F8 — another device/tab upgrading (or a payment lapsing) flips
  // this org's subscriptions row; router.refresh() re-runs getEntitlements()
  // server-side so Premium unlocks (or Free limits re-apply) here
  // immediately, same "postgres_changes filtered to this org" pattern
  // TeamClient.tsx already uses for live team-roster sync.
  useEffect(() => {
    if (!entitlements.orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`subscriptions:org:${entitlements.orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `org_id=eq.${entitlements.orgId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [entitlements.orgId, router]);

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      entitlements,
      isPremium: entitlements.tier === "premium",
      openUpgradeModal: () => setModalOpen(true),
    }),
    [entitlements],
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
      {modalOpen && <UpgradeModal onClose={() => setModalOpen(false)} />}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlementsContext(): EntitlementsContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlementsContext must be used within an EntitlementsProvider");
  return ctx;
}

// Per spec: title, message, "Upgrade Now" / "Maybe Later" buttons.
function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,20,32,.5)] p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
      >
        <span className="mb-3 inline-block rounded-full bg-accent-weak px-3 py-1 text-[11px] font-bold text-accent-text">PREMIUM</span>
        <h2 className="text-[18px] font-bold text-text">Upgrade to Inventra Premium</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">
          Unlock unlimited inventory, receipt printing, inventory editing, reports, AI tools, team collaboration,
          analytics, and more by upgrading your subscription.
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-[9px] border border-border bg-surface text-[13.5px] font-semibold text-text hover:bg-hover"
          >
            Maybe Later
          </button>
          <Link
            href="/billing"
            onClick={onClose}
            className="flex h-10 flex-1 items-center justify-center rounded-[9px] bg-accent text-[13.5px] font-semibold text-white shadow-[var(--shadow-sm)] hover:brightness-[1.06]"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    </div>
  );
}
