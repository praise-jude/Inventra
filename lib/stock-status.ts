export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

// Single source of truth for stock-status display — the actual thresholds
// (0 / 1-5 / 6+) live in the `products.status` generated column
// (supabase/migrations/20260708210000_fix_stock_status_thresholds.sql); this
// only maps that column's values to consistent labels/colors everywhere.
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export const STOCK_STATUS_COLORS: Record<StockStatus, { color: string; background: string }> = {
  in_stock: { color: "var(--green)", background: "var(--green-weak)" },
  low_stock: { color: "var(--amber)", background: "var(--amber-weak)" },
  out_of_stock: { color: "var(--red)", background: "var(--red-weak)" },
};
