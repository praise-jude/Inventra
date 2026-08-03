"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";
import { logError } from "@/lib/logger";
import { canAddInvoice, UpgradeRequiredError } from "@/lib/entitlements";
import { isGoogleCloudConfigured } from "@/lib/google-cloud/config";
import { fileExists, getSignedReadUrl, uploadFile } from "@/lib/google-cloud/storage";
import { invoicePdfStoragePath } from "@/lib/invoice-pdf-storage-path";
import { getInvoiceDetail, type InvoiceDetail } from "@/lib/queries/invoices";
import type { CustomerInvoiceStatus } from "@/lib/supabase/database.types";

export async function fetchInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  return getInvoiceDetail(id);
}

async function requireOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");
  return {
    supabase,
    orgId: profile.org_id as string,
    userId: user.id,
    role: profile.role as string,
    actorName: `${profile.first_name} ${profile.last_name}`,
  };
}

// Edit/void/delete are manager-tier+ — matches Debtors' pattern
// (customer_invoices_update/delete RLS already enforces this at the
// database layer, this just gives a clear error instead of a silent
// RLS-denied no-op). Create is open to any org member, matching Sales.
function requireManagerRole(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only an owner, admin, or manager can manage this invoice.");
  }
}

export interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  issueDate: string;
  dueDate?: string;
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  items: InvoiceItemInput[];
}

export async function createInvoice(input: InvoiceInput): Promise<string> {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  if (!(await canAddInvoice())) {
    throw new UpgradeRequiredError("You've reached your Free Plan limit of 10 invoices. Upgrade to Premium for unlimited invoices.");
  }
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error("Customer name is required.");
  if (input.items.length === 0) throw new Error("Add at least one line item.");

  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountAmount = input.discountAmount ?? 0;
  const taxAmount = input.taxAmount ?? 0;
  const total = subtotal - discountAmount + taxAmount;
  // Same convention as billing invoices (lib/billing-engine.ts's
  // invoiceNumber()) — a random suffix, not a sequential counter, so
  // there's no race condition to handle under concurrent creates.
  const invoiceNumber = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const { data: invoice, error } = await supabase
    .from("customer_invoices")
    .insert({
      org_id: orgId,
      invoice_number: invoiceNumber,
      customer_name: customerName,
      customer_email: input.customerEmail?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      issue_date: input.issueDate,
      due_date: input.dueDate || null,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    logError({ feature: "Invoices", action: "createInvoice" }, "invoice insert failed", error);
    throw new Error("Could not create the invoice.");
  }

  const itemRows = input.items.map((i) => ({
    org_id: orgId,
    invoice_id: invoice.id as string,
    product_id: i.productId || null,
    description: i.description.trim(),
    quantity: i.quantity,
    unit_price: i.unitPrice,
    line_total: i.quantity * i.unitPrice,
  }));
  const { error: itemsError } = await supabase.from("customer_invoice_items").insert(itemRows);
  if (itemsError) {
    logError({ feature: "Invoices", action: "createInvoice" }, "invoice items insert failed", itemsError);
    throw new Error("The invoice was created, but its line items could not be saved.");
  }

  revalidatePath("/invoices");
  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "invoice.created",
    module: "Invoices",
    entityType: "customer_invoice",
    entityId: invoice.id as string,
    entityLabel: invoiceNumber,
    newValue: { customerName, total },
  });
  return invoice.id as string;
}

export async function updateInvoiceStatus(id: string, status: CustomerInvoiceStatus): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  requireManagerRole(role);

  const { data: invoice } = await supabase.from("customer_invoices").select("invoice_number").eq("id", id).maybeSingle();
  const { error } = await supabase.from("customer_invoices").update({ status }).eq("id", id);
  if (error) {
    logError({ feature: "Invoices", action: "updateInvoiceStatus" }, "invoice status update failed", error);
    throw new Error("Could not update the invoice status.");
  }

  revalidatePath("/invoices");
  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "invoice.status_changed",
    module: "Invoices",
    entityType: "customer_invoice",
    entityId: id,
    entityLabel: invoice?.invoice_number ?? id,
    newValue: { status },
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const { supabase, orgId, userId, role, actorName } = await requireOrgId();
  requireManagerRole(role);

  const { data: invoice } = await supabase.from("customer_invoices").select("invoice_number").eq("id", id).maybeSingle();
  const { error } = await supabase.from("customer_invoices").delete().eq("id", id);
  if (error) {
    logError({ feature: "Invoices", action: "deleteInvoice" }, "invoice delete failed", error);
    throw new Error("Could not delete the invoice.");
  }

  revalidatePath("/invoices");
  void logAudit({
    orgId,
    actorId: userId,
    actorName,
    actorRole: role,
    action: "invoice.deleted",
    module: "Invoices",
    entityType: "customer_invoice",
    entityId: id,
    entityLabel: invoice?.invoice_number ?? id,
  });
}

// Best-effort archival of the client-generated invoice PDF to Cloud
// Storage — called after the existing instant browser download
// (InvoiceDetailSlideOver's handleDownload), never instead of it. If
// Google Cloud isn't configured, or the upload fails, this throws and the
// caller is expected to swallow the error: the download the user already
// has is the real deliverable, archival is a bonus.
export async function archiveInvoicePdf(invoiceId: string, formData: FormData): Promise<void> {
  const { orgId } = await requireOrgId();
  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file provided.");

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile({ path: invoicePdfStoragePath(orgId, invoiceId), data: buffer, contentType: "application/pdf" });
}

// Returns null (never throws) when there's no archived copy yet or Cloud
// Storage isn't configured — this is a "bonus" retrieval path, so the UI
// should treat null as "nothing to show" rather than an error.
export async function getInvoicePdfArchiveUrl(invoiceId: string): Promise<string | null> {
  if (!isGoogleCloudConfigured()) return null;
  const { orgId } = await requireOrgId();
  const path = invoicePdfStoragePath(orgId, invoiceId);
  try {
    if (!(await fileExists(path))) return null;
    return await getSignedReadUrl(path, 10);
  } catch (err) {
    logError({ feature: "Invoices", action: "getInvoicePdfArchiveUrl" }, "PDF archive URL fetch failed", err);
    return null;
  }
}
