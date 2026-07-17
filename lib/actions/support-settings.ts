"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/queries/session";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 500;

export interface UpdateSupportSettingsInput {
  whatsappNumber: string;
  whatsappMessage: string;
  businessHours: string;
  supportEmail: string;
  averageResponse: string;
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
}

// React already escapes everything it renders (no dangerouslySetInnerHTML
// is used anywhere this data flows to), so the real risk here isn't
// stored-XSS in the rendered widget — it's a length-unbounded field ending
// up in the database, or a malformed value breaking the wa.me link. This
// trims and caps length rather than stripping characters, since business
// hours / messages are meant to contain arbitrary punctuation.
function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value.trim().slice(0, maxLength);
}

export async function updateSupportSettings(input: UpdateSupportSettingsInput): Promise<void> {
  await requirePlatformAdmin();

  const supportEmail = sanitizeText(input.supportEmail, 254);
  if (supportEmail && !EMAIL_RE.test(supportEmail)) {
    throw new Error("Enter a valid support email address.");
  }

  const whatsappDigits = input.whatsappNumber.replace(/\D/g, "");
  if (input.whatsappEnabled && (whatsappDigits.length < 8 || whatsappDigits.length > 15)) {
    throw new Error("Enter a valid WhatsApp number (country code + number, digits only).");
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("support_settings").select("id").single();
  if (!existing) throw new Error("Support settings row not found.");

  const { error } = await admin
    .from("support_settings")
    .update({
      whatsapp_number: whatsappDigits,
      whatsapp_message: sanitizeText(input.whatsappMessage, 1000),
      business_hours: sanitizeText(input.businessHours, 200),
      support_email: supportEmail,
      average_response: sanitizeText(input.averageResponse, 100),
      whatsapp_enabled: input.whatsappEnabled,
      widget_enabled: input.widgetEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (error) {
    console.error("[Inventra] updateSupportSettings failed:", error);
    throw new Error("Could not save support settings.");
  }

  // Every page reads these settings via the root layout.
  revalidatePath("/", "layout");
}
