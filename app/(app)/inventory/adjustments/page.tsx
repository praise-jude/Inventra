import { getAdjustments } from "@/lib/queries/inventory";
import { getProducts } from "@/lib/queries/products";
import { AdjustmentsClient } from "@/components/inventory/AdjustmentsClient";

export default async function AdjustmentsPage() {
  const [adjustments, products] = await Promise.all([getAdjustments(50), getProducts()]);

  return (
    <AdjustmentsClient
      adjustments={adjustments}
      products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty: p.qty }))}
    />
  );
}
