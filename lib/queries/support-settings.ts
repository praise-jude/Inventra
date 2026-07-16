import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SupportSettings {
  id: string;
  tawkPropertyId: string | null;
  tawkWidgetId: string | null;
  whatsappNumber: string;
  whatsappMessage: string;
  businessHours: string;
  supportEmail: string;
  averageResponse: string;
  tawkEnabled: boolean;
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
}

const FALLBACK: SupportSettings = {
  id: "",
  tawkPropertyId: null,
  tawkWidgetId: null,
  whatsappNumber: "",
  whatsappMessage: "",
  businessHours: "",
  supportEmail: "",
  averageResponse: "",
  tawkEnabled: false,
  whatsappEnabled: false,
  widgetEnabled: false,
};

// Singleton, platform-wide config — fetched with the service-role client so
// the root layout (which renders for every visitor, logged in or not) never
// needs an RLS policy opening this table to the anon-key client.
//
// This runs unconditionally on every single page render (it's in the root
// layout), so it must NEVER throw — a transient network/connection error
// here would otherwise take down the entire site, not just the support
// widget. The try/catch is the actual point of this function, not just the
// { error } check on a successful round trip.
export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_settings").select("*").single();
    if (error || !data) {
      console.error("[Inventra] getSupportSettings failed:", error);
      return FALLBACK; // fail closed — no support widget rather than a broken page
    }
    return {
      id: data.id,
      tawkPropertyId: data.tawk_property_id,
      tawkWidgetId: data.tawk_widget_id,
      whatsappNumber: data.whatsapp_number,
      whatsappMessage: data.whatsapp_message,
      businessHours: data.business_hours,
      supportEmail: data.support_email,
      averageResponse: data.average_response,
      tawkEnabled: data.tawk_enabled,
      whatsappEnabled: data.whatsapp_enabled,
      widgetEnabled: data.widget_enabled,
    };
  } catch (err) {
    console.error("[Inventra] getSupportSettings threw:", err);
    return FALLBACK;
  }
}
