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

// Singleton, platform-wide config — fetched with the service-role client so
// the root layout (which renders for every visitor, logged in or not) never
// needs an RLS policy opening this table to the anon-key client.
export async function getSupportSettings(): Promise<SupportSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("support_settings").select("*").single();
  if (error || !data) {
    console.error("[Inventra] getSupportSettings failed:", error);
    // Fail closed — no support widget rather than a broken one.
    return {
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
}
