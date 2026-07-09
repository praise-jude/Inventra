import "server-only";
import { createClient } from "@/lib/supabase/server";
import { orIlike } from "@/lib/postgrest-filter";

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityLabel: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  branchName: string | null;
  ipAddress: string | null;
}

export interface AuditLogFilters {
  search?: string;
  module?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

const SELECT =
  "id, created_at, actor_name, actor_role, action, module, entity_label, previous_value, new_value, branch_name, ip_address";

function mapRow(r: Record<string, unknown>): AuditLogRow {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    actorName: r.actor_name as string,
    actorRole: r.actor_role as string,
    action: r.action as string,
    module: r.module as string,
    entityLabel: (r.entity_label as string | null) ?? null,
    previousValue: (r.previous_value as Record<string, unknown> | null) ?? null,
    newValue: (r.new_value as Record<string, unknown> | null) ?? null,
    branchName: (r.branch_name as string | null) ?? null,
    ipAddress: (r.ip_address as string | null) ?? null,
  };
}

export async function getAuditLogs(
  filters: AuditLogFilters,
  page = 1,
  pageSize = 25,
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("audit_logs").select(SELECT, { count: "exact" }).order("created_at", { ascending: false });
  if (filters.search?.trim()) {
    query = query.or(orIlike(["actor_name", "action", "entity_label"], filters.search));
  }
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[Inventra] getAuditLogs failed:", error);
    throw new Error("Could not load the audit log.");
  }
  return { rows: (data ?? []).map(mapRow), total: count ?? 0 };
}

// Bounded to 5000 rows for export — enough for any realistic filtered range
// without pulling an unbounded table into memory.
export async function getAuditLogExportRows(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select(SELECT).order("created_at", { ascending: false }).limit(5000);
  if (filters.search?.trim()) {
    query = query.or(orIlike(["actor_name", "action", "entity_label"], filters.search));
  }
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);

  const { data, error } = await query;
  if (error) {
    console.error("[Inventra] getAuditLogExportRows failed:", error);
    throw new Error("Could not export the audit log.");
  }
  return (data ?? []).map(mapRow);
}

export async function getAuditModules(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_logs").select("module").limit(1000);
  if (error) return [];
  return Array.from(new Set((data ?? []).map((r) => r.module as string))).sort();
}
