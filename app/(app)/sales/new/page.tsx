import { getProducts, getWarehouseOptions } from "@/lib/queries/products";
import { getCustomerOptions } from "@/lib/queries/customers";
import { requireSalesProfile } from "@/lib/queries/session";
import { NewSaleForm } from "@/components/sales/NewSaleForm";

export default async function NewSalePage() {
  const [products, customers, warehouses, { org }] = await Promise.all([
    getProducts(),
    getCustomerOptions(),
    getWarehouseOptions(),
    requireSalesProfile(),
  ]);

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">New sale</div>
        <div className="mt-[3px] text-text-2">Record a transaction and update stock automatically.</div>
      </div>
      <NewSaleForm
        products={products.filter((p) => p.qty > 0 && p.isActive)}
        customers={customers}
        warehouses={warehouses}
        taxRate={Number(org.tax_rate)}
      />
    </div>
  );
}
