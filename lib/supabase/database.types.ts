export type UserRole = "owner" | "admin" | "manager" | "cashier" | "warehouse";
export type MemberStatus = "active" | "invited";
export type MovementType = "received" | "sale" | "adjustment" | "transfer" | "return" | "expired";
export type InvoiceStatus = "paid" | "pending" | "failed";
export type IntegrationProvider =
  | "stripe"
  | "paystack"
  | "quickbooks"
  | "slack"
  | "google_drive"
  | "webhooks";
export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface Organization {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  tax_rate: number;
  support_email: string | null;
  plan: string;
  trial_ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  theme_preference: string;
  last_active_at: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  manager_profile_id: string | null;
  capacity: number | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  org_id: string;
  name: string;
  emoji: string | null;
}

export interface Product {
  id: string;
  org_id: string;
  category_id: string | null;
  warehouse_id: string | null;
  supplier_id: string | null;
  name: string;
  description: string | null;
  emoji: string | null;
  brand: string | null;
  sku: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  reorder_level: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_damaged: number;
  qty_returned: number;
  expiry_date: string | null;
  batch_number: string | null;
  status: ProductStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  org_id: string;
  product_id: string;
  name: string;
  sku_suffix: string | null;
  price_delta: number;
  qty_on_hand: number;
}

export interface StockMovement {
  id: string;
  org_id: string;
  product_id: string;
  warehouse_id: string | null;
  type: MovementType;
  qty_delta: number;
  unit_price: number | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  invoice_number: string;
  amount: number;
  status: InvoiceStatus;
  issued_at: string;
}

export interface MonthlyStat {
  org_id: string;
  month: string;
  revenue: number;
  profit: number;
}

export interface NotificationSettings {
  org_id: string;
  low_stock: boolean;
  out_of_stock: boolean;
  expiring_products: boolean;
  new_purchase_orders: boolean;
  weekly_digest: boolean;
}

export interface Integration {
  org_id: string;
  provider: IntegrationProvider;
  status: string;
  connected_at: string | null;
}

export interface DashboardKpis {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  active_suppliers: number;
  today_revenue: number;
  yesterday_revenue: number;
  monthly_profit: number | null;
  prior_monthly_profit: number | null;
}

export interface CategoryMixRow {
  name: string;
  value: number;
  pct: number;
}

export interface TopSellerRow {
  product_id: string;
  name: string;
  emoji: string | null;
  units: number;
  revenue: number;
  trend_pct: number | null;
}

export interface StockHealthRow {
  label: "in_stock" | "low_stock" | "out_of_stock" | "expiring";
  count: number;
}

// Minimal Database shape — enough for the typed supabase-js client used by
// lib/supabase/admin.ts. Table/RPC generics beyond this are accessed with
// explicit row types in each query module rather than full schema codegen.
export type Database = Record<string, unknown>;
