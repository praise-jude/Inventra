import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/queries/session";
import { PrintingSettingsForm } from "@/components/settings/PrintingSettingsForm";

export default async function PrintingSettingsPage() {
  const { org } = await requireAdminProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("print_settings").select("*").eq("org_id", org.id).single();

  return (
    <PrintingSettingsForm
      paperSize={data?.paper_size ?? "80mm"}
      autoPrint={data?.auto_print ?? false}
      receiptFooter={data?.receipt_footer ?? ""}
    />
  );
}
