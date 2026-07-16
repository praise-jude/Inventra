"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";
import { getAuditLogExportRows, type AuditLogFilters, type AuditLogRow } from "@/lib/queries/audit";

export interface AuditLogInput {
  orgId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  branchId?: string | null;
  branchName?: string | null;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function clientDevice(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

// Fire-and-forget by design: a failed audit insert must never break the
// mutation it's describing (e.g. a stock adjustment should still succeed
// even if the audit_logs insert fails for some reason) — errors are logged,
// never thrown.
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient();
    const [ip, device] = await Promise.all([clientIp(), clientDevice()]);
    const { error } = await supabase.from("audit_logs").insert({
      org_id: input.orgId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      actor_role: input.actorRole,
      action: input.action,
      module: input.module,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      previous_value: input.previousValue ?? null,
      new_value: input.newValue ?? null,
      branch_id: input.branchId ?? null,
      branch_name: input.branchName ?? null,
      ip_address: ip,
      device,
    });
    if (error) console.error("[Inventra] logAudit insert failed:", error);
  } catch (err) {
    console.error("[Inventra] logAudit failed:", err);
  }
}

// Called after a successful sign-in (password login page, and the OAuth
// callback route for the default /dashboard path only — not the
// invite-accept/reset-password reuses of the same callback route).
export async function recordLogin(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, first_name, last_name, role")
      .eq("id", user.id)
      .single();
    if (!profile) return;

    await logAudit({
      orgId: profile.org_id,
      actorId: user.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "user.login",
      module: "Auth",
      entityType: "profile",
      entityId: user.id,
      entityLabel: `${profile.first_name} ${profile.last_name}`,
    });
  } catch (err) {
    console.error("[Inventra] recordLogin failed:", err);
  }
}

// Exposes the server-only audit query to the client Export menu — RLS
// (audit_logs_select is admin-tier only) is still the real gate; this just
// wraps it in a server action so a client component can call it.
export async function fetchAuditLogExportRows(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  return getAuditLogExportRows(filters);
}
