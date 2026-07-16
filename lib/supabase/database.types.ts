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
  | "webhooks"
  | "pos_online"
  | "pos_offline"
  | "receipt_printing";
export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";
export type AdjustmentType = "increase" | "decrease" | "damaged" | "expired" | "count_correction" | "loss" | "other";
export type DebtorStatus = "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type ExpenseCategory =
  | "rent"
  | "salary"
  | "transport"
  | "utilities"
  | "inventory_purchase"
  | "logistics"
  | "miscellaneous";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_money";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "payment_failed"
  | "cancelled"
  | "expired"
  | "suspended";
export type BillingInterval = "monthly" | "yearly";
export type PaymentAttemptStatus = "success" | "failed" | "pending";

export interface Organization {
  id: string;
  name: string;
  business_email: string | null;
  country: string | null;
  state: string | null;
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
  terms_accepted: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  terms_accepted_ip: string | null;
  last_active_at: string | null;
  suspended_at: string | null;
  branch_id: string | null;
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
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  contact_person: string | null;
  created_at: string;
}

export interface Debtor {
  id: string;
  org_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  amount_owed: number;
  due_date: string | null;
  status: DebtorStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtorPayment {
  id: string;
  org_id: string;
  debtor_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_by: string | null;
}

export interface Expense {
  id: string;
  org_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  incurred_at: string;
  created_by: string | null;
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
  is_active: boolean;
  image_url: string | null;
  barcode: string | null;
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
  adjustment_type: AdjustmentType | null;
  notes: string | null;
  sale_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  branch_id: string | null;
  branch_name: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  org_id: string;
  customer_id: string | null;
  walk_in_name: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalePayment {
  id: string;
  org_id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
}

export interface Invoice {
  id: string;
  org_id: string;
  invoice_number: string;
  amount: number;
  status: InvoiceStatus;
  issued_at: string;
  paystack_reference: string | null;
  plan_key: string | null;
  billing_interval: BillingInterval | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
}

export interface Subscription {
  org_id: string;
  status: SubscriptionStatus;
  plan_key: string;
  billing_interval: BillingInterval | null;
  amount: number | null;
  currency: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_reminders_sent: number;
  renewal_reminder_sent: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
  paystack_email_token: string | null;
  paystack_plan_code: string | null;
  authorization_code: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: string | null;
  card_exp_year: string | null;
  card_bank: string | null;
  failed_payment_count: number;
  last_payment_attempt_at: string | null;
  last_payment_error: string | null;
  next_retry_at: string | null;
  grandfathered: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  org_id: string;
  invoice_id: string | null;
  attempt_number: number;
  status: PaymentAttemptStatus;
  amount: number;
  currency: string;
  paystack_reference: string | null;
  failure_reason: string | null;
  attempted_at: string;
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

export interface PrintSettings {
  org_id: string;
  paper_size: string;
  auto_print: boolean;
  receipt_footer: string | null;
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
  total_inventory_cost: number;
  total_inventory_value: number;
  total_expected_profit: number;
  total_stock_qty: number;
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

export interface DailyProductProfitRow {
  product_id: string;
  name: string;
  emoji: string | null;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
}

// Minimal Database shape — enough for the typed supabase-js client used by
// lib/supabase/admin.ts. Table/RPC generics beyond this are accessed with
// explicit row types in each query module rather than full schema codegen.
export type Database = Record<string, unknown>;
