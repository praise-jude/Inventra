"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Settings mutations are Admin-tier only. `organizations_update` RLS already
// enforces this at the database layer, but checking here first gives a clear
// error instead of a silent no-op if this action is ever called directly.
async function requireAdminOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can update settings.");
  }
  return { supabase, orgId: profile.org_id as string };
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
  const { supabase, orgId } = await requireAdminOrgId();
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
}

export async function toggleNotification(field: string, value: boolean) {
  const { supabase, orgId } = await requireAdminOrgId();
  const { error } = await supabase.from("notification_settings").update({ [field]: value }).eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/notifications");
}

export interface PrintSettingsInput {
  paperSize: string;
  autoPrint: boolean;
  receiptFooter: string;
}

export async function updatePrintSettings(input: PrintSettingsInput) {
  const { supabase, orgId } = await requireAdminOrgId();
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
}

export async function toggleIntegration(provider: string, connect: boolean) {
  const { supabase, orgId } = await requireAdminOrgId();
  const { error } = await supabase
    .from("integrations")
    .update({ status: connect ? "connected" : "not_connected", connected_at: connect ? new Date().toISOString() : null })
    .eq("org_id", orgId)
    .eq("provider", provider);
  if (error) throw error;
  revalidatePath("/settings/integrations");
}
