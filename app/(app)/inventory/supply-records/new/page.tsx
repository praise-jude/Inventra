import { getWarehouseOptions } from "@/lib/queries/products";
import { getSupplierOptions } from "@/lib/queries/suppliers";
import { requireManagerProfile } from "@/lib/queries/session";
import { NewSupplyRecordForm } from "@/components/supply-records/NewSupplyRecordForm";

export default async function NewSupplyRecordPage() {
  const [warehouses, suppliers] = await Promise.all([getWarehouseOptions(), getSupplierOptions(), requireManagerProfile()]);

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">New supply record</div>
        <div className="mt-[3px] text-text-2">Record a delivery from a supplier. Stock updates once it&apos;s marked Received or Verified.</div>
      </div>
      <NewSupplyRecordForm warehouses={warehouses} suppliers={suppliers} />
    </div>
  );
}
