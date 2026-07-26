import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Centralized Free/Premium plan-tier permission service. Separate from
// lib/roles.ts's ADMIN_ROLES/MANAGER_ROLES (role-tier, e.g. "can a Cashier
// edit inventory") — plan-tier and role-tier checks compose (both must
// pass), they never merge. Every page, API route, and Server Action that
// needs a plan-tier check should call the functions below rather than
// re-deriving tier/limits itself. Hand-mirrored in
// royal-inventra/src/lib/entitlements.ts — keep both in sync.

export type PlanTier = "free" | "premium";

export interface Entitlements {
  tier: PlanTier;
  planKey: string | null;
  status: string | null;
  productCount: number;
  productLimit: number;
  salesCount: number;
  salesLimit: number;
  expenseCount: number;
  expenseLimit: number;
  debtorCount: number;
  debtorLimit: number;
}

const FAIL_SAFE_FREE: Entitlements = {
  tier: "free",
  planKey: null,
  status: null,
  productCount: 0,
  productLimit: 50,
  salesCount: 0,
  salesLimit: 500,
  expenseCount: 0,
  expenseLimit: 100,
  debtorCount: 0,
  debtorLimit: 100,
};

// One request-scoped round trip to get_org_entitlements() (see
// supabase/migrations/20260726091940_freemium_premium_plans.sql) — every
// can*() below reads from this same cached snapshot, so a page that calls
// several of them still only queries once.
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_org_entitlements");
  if (error || !data) return FAIL_SAFE_FREE;

  const d = data as Record<string, unknown>;
  return {
    tier: d.tier === "premium" ? "premium" : "free",
    planKey: (d.plan_key as string | null) ?? null,
    status: (d.status as string | null) ?? null,
    productCount: Number(d.product_count ?? 0),
    productLimit: Number(d.product_limit ?? FAIL_SAFE_FREE.productLimit),
    salesCount: Number(d.sales_count ?? 0),
    salesLimit: Number(d.sales_limit ?? FAIL_SAFE_FREE.salesLimit),
    expenseCount: Number(d.expense_count ?? 0),
    expenseLimit: Number(d.expense_limit ?? FAIL_SAFE_FREE.expenseLimit),
    debtorCount: Number(d.debtor_count ?? 0),
    debtorLimit: Number(d.debtor_limit ?? FAIL_SAFE_FREE.debtorLimit),
  };
});

// Boolean-locked features (not count-based) — Premium unlocks all of them,
// Free unlocks none. Matches the prompt's "locked premium features" list.
const PREMIUM_FEATURES = [
  "receiptPrinting",
  "inventoryEdit",
  "inventoryDelete",
  "barcodeGeneration",
  "productTransfer",
  "teamManagement",
  "staffRoles",
  "branchManagement",
  "reports",
  "exportReports",
  "aiAssistant",
  "businessAnalytics",
  "integrations",
  "apiAccess",
  "webhooks",
  "auditLog",
  "advancedSettings",
  "multiLocationInventory",
  "approvalWorkflows",
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export async function canUseFeature(feature: PremiumFeature): Promise<boolean> {
  void feature; // every locked feature has the same rule today: Premium-only
  const e = await getEntitlements();
  return e.tier === "premium";
}

// Count-limited creates — RLS (this migration) is the real enforcement;
// these exist so the UI/Server Action can show a friendly "Upgrade to
// Premium" message instead of surfacing a raw Postgres RLS error.
export async function canAddProduct(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === "premium" || e.productCount < e.productLimit;
}
export async function canCreateSale(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === "premium" || e.salesCount < e.salesLimit;
}
export async function canAddExpense(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === "premium" || e.expenseCount < e.expenseLimit;
}
export async function canAddDebtor(): Promise<boolean> {
  const e = await getEntitlements();
  return e.tier === "premium" || e.debtorCount < e.debtorLimit;
}

// Named per-feature checks — thin wrappers over canUseFeature(), all
// reading from the one cached getEntitlements() snapshot.
export const canEditProduct = () => canUseFeature("inventoryEdit");
export const canDeleteProduct = () => canUseFeature("inventoryDelete");
export const canPrintReceipt = () => canUseFeature("receiptPrinting");
export const canGenerateBarcode = () => canUseFeature("barcodeGeneration");
export const canTransferProduct = () => canUseFeature("productTransfer");
export const canExportReports = () => canUseFeature("exportReports");
export const canViewReports = () => canUseFeature("reports");
export const canUseAI = () => canUseFeature("aiAssistant");
export const canManageTeam = () => canUseFeature("teamManagement");
export const canManageStaffRoles = () => canUseFeature("staffRoles");
export const canManageBranches = () => canUseFeature("branchManagement");
export const canViewBusinessAnalytics = () => canUseFeature("businessAnalytics");
export const canManageIntegrations = () => canUseFeature("integrations");
export const canUseApi = () => canUseFeature("apiAccess");
export const canManageWebhooks = () => canUseFeature("webhooks");
export const canViewAuditLog = () => canUseFeature("auditLog");
export const canUseAdvancedSettings = () => canUseFeature("advancedSettings");
export const canUseMultiLocationInventory = () => canUseFeature("multiLocationInventory");
export const canUseApprovalWorkflows = () => canUseFeature("approvalWorkflows");

// PREMIUM_UPGRADE_ERROR — thrown from Server Actions when a can*() check
// fails, so client code can distinguish "needs upgrade" from any other
// error and show the Upgrade modal (see components/billing/UpgradeModal.tsx).
export class UpgradeRequiredError extends Error {
  constructor(message = "This feature requires a Premium subscription.") {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}
