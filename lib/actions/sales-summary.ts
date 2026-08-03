"use server";

import { requireAdminProfile } from "@/lib/queries/session";
import { canViewAuditLog } from "@/lib/entitlements";
import { getDailySalesSummary, getSalesForDay, type DailySalesSummaryRow, type DaySaleRow } from "@/lib/queries/sales-summary";

// Server Actions are directly callable regardless of which page rendered
// the button that triggers them — the audit-log page's own
// requireAdminProfile()/canViewAuditLog() gate only protects that page's
// render, so these need the same check independently (defense in depth,
// same reasoning as every other gated action in this codebase).
async function requireAuditLogAccess(): Promise<void> {
  await requireAdminProfile();
  if (!(await canViewAuditLog())) throw new Error("Viewing the audit log requires a Premium subscription.");
}

export async function fetchDailySalesSummary(from: string, to: string): Promise<DailySalesSummaryRow[]> {
  await requireAuditLogAccess();
  return getDailySalesSummary(from, to);
}

export async function fetchSalesForDay(day: string): Promise<DaySaleRow[]> {
  await requireAuditLogAccess();
  return getSalesForDay(day);
}
