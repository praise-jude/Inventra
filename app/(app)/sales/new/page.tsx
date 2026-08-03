import { getWarehouseOptions } from "@/lib/queries/products";
import { requireSalesProfile } from "@/lib/queries/session";
import { NewSaleForm } from "@/components/sales/NewSaleForm";

export default async function NewSalePage() {
  const [warehouses, { profile, org }] = await Promise.all([getWarehouseOptions(), requireSalesProfile()]);
  // Only Cashier can reach this page (requireSalesProfile redirects
  // Warehouse-role away) — lock the branch field to their assigned branch
  // so their sales are tagged correctly instead of leaving an easy-to-skip
  // optional dropdown. Untouched for Owner/Admin/Manager, who keep picking
  // freely as they do today.
  const lockedWarehouseId = profile.role === "cashier" ? profile.branch_id : null;

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">New sale</div>
        <div className="mt-[3px] text-text-2">Record a transaction and update stock automatically.</div>
      </div>
      <NewSaleForm warehouses={warehouses} taxRate={Number(org.tax_rate)} lockedWarehouseId={lockedWarehouseId} />
    </div>
  );
}
