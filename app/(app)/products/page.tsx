import { Suspense } from "react";
import { getProducts, getCategories, getWarehouseOptions, getSupplierOptions } from "@/lib/queries/products";
import { ProductsClient } from "@/components/products/ProductsClient";

export default async function ProductsPage() {
  const [products, categories, warehouses, suppliers] = await Promise.all([
    getProducts(),
    getCategories(),
    getWarehouseOptions(),
    getSupplierOptions(),
  ]);

  return (
    <Suspense>
      <ProductsClient products={products} categories={categories} warehouses={warehouses} suppliers={suppliers} />
    </Suspense>
  );
}
