"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { canUseApprovalWorkflows, UpgradeRequiredError } from "@/lib/entitlements";

// Settings mutations are Admin-tier only. `organizations_update` RLS already
// enforces this at the database layer, but checking here first gives a clear
// error instead of a silent no-op if this action is ever called directly.
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
    throw new Error("Only an owner or admin can update settings.");
  }
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

export interface GeneralSettingsInput {
  name: string;
  supportEmail: string;
  currency: string;
  country: string;
  state: string;
  timezone: string;
  taxRate: number;
}

export async function updateGeneralSettings(input: GeneralSettingsInput) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      support_email: input.supportEmail,
      currency: input.currency,
      country: input.country || null,
      state: input.state || null,
      timezone: input.timezone,
      tax_rate: input.taxRate,
    })
    .eq("id", orgId);
  if (error) throw error;
  revalidatePath("/settings/general");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "organization",
    entityId: orgId,
    entityLabel: "General settings",
    newValue: { name: input.name, currency: input.currency, timezone: input.timezone, taxRate: input.taxRate },
  });
}

export async function toggleNotification(field: string, value: boolean) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase.from("notification_settings").update({ [field]: value }).eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/notifications");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "notification_settings",
    entityLabel: `Notification: ${field}`,
    newValue: { [field]: value },
  });
}

export async function updateLargeSupplyThreshold(amount: number | null) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase.from("notification_settings").update({ large_supply_threshold_amount: amount }).eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/notifications");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "notification_settings",
    entityLabel: "Large supply notification threshold",
    newValue: { large_supply_threshold_amount: amount },
  });
}

export interface PrintSettingsInput {
  paperSize: string;
  autoPrint: boolean;
  receiptFooter: string;
}

export async function updatePrintSettings(input: PrintSettingsInput) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase
    .from("print_settings")
    .update({
      paper_size: input.paperSize,
      auto_print: input.autoPrint,
      receipt_footer: input.receiptFooter || null,
    })
    .eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/printing");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "print_settings",
    entityLabel: "Print settings",
    newValue: { paperSize: input.paperSize, autoPrint: input.autoPrint },
  });
}

export interface ApprovalSettingsInput {
  discountApprovalEnabled: boolean;
  discountThresholdPct: number;
  voidApprovalEnabled: boolean;
  voidThresholdAmount: number;
  priceChangeApprovalEnabled: boolean;
  priceChangeThresholdPct: number;
}

export async function updateApprovalSettings(input: ApprovalSettingsInput) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  if (!(await canUseApprovalWorkflows())) throw new UpgradeRequiredError("Approval workflows require a Premium subscription.");
  const { error } = await supabase
    .from("approval_settings")
    .update({
      discount_approval_enabled: input.discountApprovalEnabled,
      discount_threshold_pct: input.discountThresholdPct,
      void_approval_enabled: input.voidApprovalEnabled,
      void_threshold_amount: input.voidThresholdAmount,
      price_change_approval_enabled: input.priceChangeApprovalEnabled,
      price_change_threshold_pct: input.priceChangeThresholdPct,
    })
    .eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/approvals");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "approval_settings",
    entityLabel: "Approval thresholds",
    newValue: {
      discountApprovalEnabled: input.discountApprovalEnabled,
      discountThresholdPct: input.discountThresholdPct,
      voidApprovalEnabled: input.voidApprovalEnabled,
      voidThresholdAmount: input.voidThresholdAmount,
      priceChangeApprovalEnabled: input.priceChangeApprovalEnabled,
      priceChangeThresholdPct: input.priceChangeThresholdPct,
    },
  });
}

export async function toggleIntegration(provider: string, connect: boolean) {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase
    .from("integrations")
    .update({ status: connect ? "connected" : "not_connected", connected_at: connect ? new Date().toISOString() : null })
    .eq("org_id", orgId)
    .eq("provider", provider);
  if (error) throw error;
  revalidatePath("/settings/integrations");

  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "integration",
    entityLabel: `Integration: ${provider}`,
    newValue: { provider, connected: connect },
  });
}

const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/.+/;

// Slack is a real integration (unlike the cosmetic toggles above) — needs
// an actual webhook URL to post to, so it gets its own connect flow rather
// than toggleIntegration's bare status flip. Sends a real test message as
// part of connecting, so a typo'd/revoked URL is caught immediately
// instead of silently failing the first time a stock alert tries to fire.
export async function saveSlackWebhook(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  const url = webhookUrl.trim();
  if (!SLACK_WEBHOOK_RE.test(url)) {
    return { ok: false, error: "That doesn't look like a Slack Incoming Webhook URL (should start with https://hooks.slack.com/services/)." };
  }

  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();

  let testRes: Response;
  try {
    testRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "✅ Inventra is now connected — stock alerts will post here." }),
    });
  } catch {
    return { ok: false, error: "Could not reach that URL. Check it was copied correctly." };
  }
  if (!testRes.ok) {
    return { ok: false, error: "Slack rejected the test message — this webhook may have been revoked. Create a new one." };
  }

  const { error } = await supabase
    .from("integrations")
    .update({ status: "connected", connected_at: new Date().toISOString(), config: { webhook_url: url } })
    .eq("org_id", orgId)
    .eq("provider", "slack");
  if (error) return { ok: false, error: "Could not save the connection. Please try again." };

  revalidatePath("/settings/integrations");
  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "integration",
    entityLabel: "Integration: slack",
    newValue: { provider: "slack", connected: true },
  });
  return { ok: true };
}

export async function disconnectSlack(): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireAdminOrgId();
  const { error } = await supabase
    .from("integrations")
    .update({ status: "not_connected", connected_at: null, config: null })
    .eq("org_id", orgId)
    .eq("provider", "slack");
  if (error) throw error;

  revalidatePath("/settings/integrations");
  await logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "settings.updated",
    module: "Settings",
    entityType: "integration",
    entityLabel: "Integration: slack",
    newValue: { provider: "slack", connected: false },
  });
}
