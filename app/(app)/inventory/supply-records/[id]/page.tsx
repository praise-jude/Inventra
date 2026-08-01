import { notFound } from "next/navigation";
import { getSupplyRecordDetail } from "@/lib/queries/supply-records";
import { requireProfile } from "@/lib/queries/session";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { SupplyRecordDetailClient } from "@/components/supply-records/SupplyRecordDetailClient";

export default async function SupplyRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  const supabase = await createClient();
  await requirePermission(supabase, "supply_records", "view");

  const record = await getSupplyRecordDetail(id);
  if (!record) notFound();

  return <SupplyRecordDetailClient record={record} isManager={["owner", "admin", "manager"].includes(profile.role)} />;
}
