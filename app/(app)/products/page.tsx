import { Suspense } from "react";
import { getProductsPage, getCategories, getWarehouseOptions, getSupplierOptions, type ProductsPageFilters } from "@/lib/queries/products";
import { ProductsClient } from "@/components/products/ProductsClient";

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters: ProductsPageFilters = {
    search: params.q,
    categoryId: params.category,
    warehouseId: params.warehouse,
    supplierId: params.supplier,
    status: params.status as ProductsPageFilters["status"],
    active: params.active as ProductsPageFilters["active"],
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    minMarginPct: params.minMargin ? Number(params.minMargin) : undefined,
    maxMarginPct: params.maxMargin ? Number(params.maxMargin) : undefined,
    expiryFrom: params.expiryFrom,
    expiryTo: params.expiryTo,
    createdFrom: params.createdFrom,
    createdTo: params.createdTo,
  };
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total }, categories, warehouses, suppliers] = await Promise.all([
    getProductsPage(filters, page, PAGE_SIZE),
    getCategories(),
    getWarehouseOptions(),
    getSupplierOptions(),
  ]);

  return (
    <Suspense>
      <ProductsClient
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        categories={categories}
        warehouses={warehouses}
        suppliers={suppliers}
        filters={{
          q: params.q ?? "",
          category: params.category ?? "",
          warehouse: params.warehouse ?? "",
          supplier: params.supplier ?? "",
          status: params.status ?? "",
          active: params.active ?? "",
          minPrice: params.minPrice ?? "",
          maxPrice: params.maxPrice ?? "",
          minMargin: params.minMargin ?? "",
          maxMargin: params.maxMargin ?? "",
          expiryFrom: params.expiryFrom ?? "",
          expiryTo: params.expiryTo ?? "",
          createdFrom: params.createdFrom ?? "",
          createdTo: params.createdTo ?? "",
        }}
      />
    </Suspense>
  );
}
