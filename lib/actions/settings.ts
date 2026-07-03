"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  return { supabase, orgId: profile.org_id as string };
}

export interface GeneralSettingsInput {
  name: string;
  supportEmail: string;
  currency: string;
  timezone: string;
  taxRate: number;
}

export async function updateGeneralSettings(input: GeneralSettingsInput) {
  const { supabase, orgId } = await requireOrgId();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      support_email: input.supportEmail,
      currency: input.currency,
      timezone: input.timezone,
      tax_rate: input.taxRate,
    })
    .eq("id", orgId);
  if (error) throw error;
  revalidatePath("/settings/general");
}

export async function toggleNotification(field: string, value: boolean) {
  const { supabase, orgId } = await requireOrgId();
  const { error } = await supabase.from("notification_settings").update({ [field]: value }).eq("org_id", orgId);
  if (error) throw error;
  revalidatePath("/settings/notifications");
}

export async function toggleIntegration(provider: string, connect: boolean) {
  const { supabase, orgId } = await requireOrgId();
  const { error } = await supabase
    .from("integrations")
    .update({ status: connect ? "connected" : "not_connected", connected_at: connect ? new Date().toISOString() : null })
    .eq("org_id", orgId)
    .eq("provider", provider);
  if (error) throw error;
  revalidatePath("/settings/integrations");
}
