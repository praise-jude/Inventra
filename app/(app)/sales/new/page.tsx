import { getWarehouseOptions } from "@/lib/queries/products";
import { requireSalesProfile } from "@/lib/queries/session";
import { NewSaleForm } from "@/components/sales/NewSaleForm";

export default async function NewSalePage() {
  const [warehouses, { org }] = await Promise.all([getWarehouseOptions(), requireSalesProfile()]);

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">New sale</div>
        <div className="mt-[3px] text-text-2">Record a transaction and update stock automatically.</div>
      </div>
      <NewSaleForm warehouses={warehouses} taxRate={Number(org.tax_rate)} />
    </div>
  );
}
