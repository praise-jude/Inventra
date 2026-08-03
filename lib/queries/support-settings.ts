import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SupportSettings {
  id: string;
  whatsappNumber: string;
  whatsappMessage: string;
  businessHours: string;
  supportEmail: string;
  averageResponse: string;
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
}

const FALLBACK: SupportSettings = {
  id: "",
  whatsappNumber: "",
  whatsappMessage: "",
  businessHours: "",
  supportEmail: "",
  averageResponse: "",
  whatsappEnabled: false,
  widgetEnabled: false,
};

// Singleton, platform-wide config — fetched with the service-role client so
// the root layout (which renders for every visitor, logged in or not) never
// needs an RLS policy opening this table to the anon-key client.
//
// This runs unconditionally on every single page render (it's in the root
// layout) and previously did a live DB round trip every time, blocking the
// very first byte of every page. unstable_cache lets a successful read
// serve every request for up to a minute (or until updateSupportSettings()
// calls revalidateTag below) instead. The fetch itself throws on failure so
// a transient error is never what gets cached — only a real row is.
const getSupportSettingsCached = unstable_cache(
  async (): Promise<SupportSettings> => {
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_settings").select("*").single();
    if (error || !data) throw error ?? new Error("support_settings row not found");
    return {
      id: data.id,
      whatsappNumber: data.whatsapp_number,
      whatsappMessage: data.whatsapp_message,
      businessHours: data.business_hours,
      supportEmail: data.support_email,
      averageResponse: data.average_response,
      whatsappEnabled: data.whatsapp_enabled,
      widgetEnabled: data.widget_enabled,
    };
  },
  ["support-settings"],
  { revalidate: 60, tags: ["support-settings"] },
);

// Must NEVER throw — this runs in the root layout for every visitor, logged
// in or not, so a transient failure here would otherwise take down the
// entire site instead of just the support widget.
export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    return await getSupportSettingsCached();
  } catch (err) {
    console.error("[Inventra] getSupportSettings failed:", err);
    return FALLBACK; // fail closed — no support widget rather than a broken page
  }
}
