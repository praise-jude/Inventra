import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { NotificationsClient } from "@/components/settings/NotificationsClient";

export default async function NotificationsSettingsPage() {
  const { org } = await requireAdminProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("notification_settings").select("*").eq("org_id", org.id).single();

  const initial = {
    low_stock: data?.low_stock ?? true,
    out_of_stock: data?.out_of_stock ?? true,
    expiring_products: data?.expiring_products ?? true,
    new_purchase_orders: data?.new_purchase_orders ?? true,
    weekly_digest: data?.weekly_digest ?? false,
  };

  return <NotificationsClient initial={initial} />;
}
