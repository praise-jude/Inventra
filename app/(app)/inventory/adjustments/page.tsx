import { getAdjustments } from "@/lib/queries/inventory";
import { AdjustmentsClient } from "@/components/inventory/AdjustmentsClient";

export default async function AdjustmentsPage() {
  const adjustments = await getAdjustments(50);

  return <AdjustmentsClient adjustments={adjustments} />;
}
