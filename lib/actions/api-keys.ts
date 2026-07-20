"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { generateApiKey, type ApiKeyRow } from "@/lib/api-keys-service";
import { ALL_API_SCOPES, type ApiScope } from "@/lib/api-auth";

// API keys are Admin-tier only to manage — api_keys_write_admin RLS
// already enforces this, but checking here first gives a clear error
// instead of a silent no-op.
async function requireAdminOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can manage API keys.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const { supabase, orgId } = await requireAdminOrgId();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load API keys.");
  return (data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    scopes: k.scopes as ApiScope[],
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
  }));
}

export async function createApiKey(name: string, scopes: ApiScope[]): Promise<{ id: string; rawKey: string }> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Give this key a name so you can identify it later.");
  const validScopes = scopes.filter((s) => ALL_API_SCOPES.includes(s));
  if (validScopes.length === 0) throw new Error("Select at least one scope.");

  const generated = generateApiKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      org_id: orgId,
      name: trimmedName,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      scopes: validScopes,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[Inventra] createApiKey failed:", error);
    throw new Error("Could not create the API key.");
  }
  revalidatePath("/settings/api-keys");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "api_key.created",
    module: "Settings",
    entityType: "api_key",
    entityId: data.id,
    entityLabel: trimmedName,
    newValue: { scopes: validScopes },
  });

  return { id: data.id, rawKey: generated.raw };
}

export async function revokeApiKey(id: string): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { data: key } = await supabase.from("api_keys").select("name").eq("id", id).eq("org_id", orgId).maybeSingle();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throw new Error("Could not revoke this API key.");
  revalidatePath("/settings/api-keys");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "api_key.revoked",
    module: "Settings",
    entityType: "api_key",
    entityId: id,
    entityLabel: key?.name ?? id,
  });
}
