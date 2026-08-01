import { getProducts, getWarehouseOptions } from "@/lib/queries/products";
import { getSuppliersDetailed } from "@/lib/queries/suppliers";
import { requireManagerProfile } from "@/lib/queries/session";
import { NewSupplyRecordForm } from "@/components/supply-records/NewSupplyRecordForm";

export default async function NewSupplyRecordPage() {
  const [products, warehouses, suppliers] = await Promise.all([getProducts(), getWarehouseOptions(), getSuppliersDetailed(), requireManagerProfile()]);

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">New supply record</div>
        <div className="mt-[3px] text-text-2">Record a delivery from a supplier. Stock updates once it&apos;s marked Received or Verified.</div>
      </div>
      <NewSupplyRecordForm
        products={products.filter((p) => p.isActive)}
        warehouses={warehouses}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone, email: s.email }))}
      />
    </div>
  );
}
