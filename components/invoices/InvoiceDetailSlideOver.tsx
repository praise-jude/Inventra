"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { useWorkspace } from "@/components/app/CurrencyProvider";
import { useEntitlementsContext } from "@/components/billing/EntitlementsProvider";
import { archiveInvoicePdf, deleteInvoice, getInvoicePdfArchiveUrl, updateInvoiceStatus } from "@/lib/actions/invoices";
import { exportCustomerInvoicePdf } from "@/lib/export";
import type { InvoiceDetail } from "@/lib/queries/invoices";
import type { CustomerInvoiceStatus } from "@/lib/supabase/database.types";

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  draft: { color: "var(--muted)", background: "var(--hover)" },
  sent: { color: "var(--sky)", background: "var(--sky-weak)" },
  paid: { color: "var(--green)", background: "var(--green-weak)" },
  overdue: { color: "var(--red)", background: "var(--red-weak)" },
  void: { color: "var(--muted)", background: "var(--hover)" },
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export function InvoiceDetailSlideOver({
  invoice,
  orgName,
  canManage,
  onClose,
}: {
  invoice: InvoiceDetail;
  orgName: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const flash = useToast();
  const { format: formatMoney, formatShortDate } = useWorkspace();
  const { isPremium, openUpgradeModal } = useEntitlementsContext();
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);

  async function handleStatusChange(status: string) {
    setStatusBusy(true);
    try {
      await updateInvoiceStatus(invoice.id, status as CustomerInvoiceStatus);
      flash("Status updated");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}? This can't be undone.`)) return;
    setDeleteBusy(true);
    try {
      await deleteInvoice(invoice.id);
      flash("Invoice deleted");
      onClose();
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete the invoice.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleDownload() {
    if (!isPremium) {
      openUpgradeModal();
      return;
    }
    const blob = await exportCustomerInvoicePdf({
      orgName,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: formatShortDate(invoice.issueDate),
      dueDate: invoice.dueDate ? formatShortDate(invoice.dueDate) : null,
      status: invoice.status,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      items: invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      notes: invoice.notes,
      formatMoney,
    });

    // Best-effort cloud archive — the download above already happened;
    // this just also keeps a durable copy so it can be re-fetched later
    // without regenerating in the browser. Never blocks or surfaces an
    // error for the download itself if this fails.
    const formData = new FormData();
    formData.append("file", blob, `${invoice.invoiceNumber}.pdf`);
    archiveInvoicePdf(invoice.id, formData).catch(() => {});
  }

  async function handleViewCloudCopy() {
    setCloudBusy(true);
    try {
      const url = await getInvoicePdfArchiveUrl(invoice.id);
      if (!url) {
        flash("No cloud copy yet — download the PDF first to create one.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      flash("Could not reach the cloud copy right now.");
    } finally {
      setCloudBusy(false);
    }
  }

  const facts = [
    { k: "Email", v: invoice.customerEmail ?? "—" },
    { k: "Phone", v: invoice.customerPhone ?? "—" },
    { k: "Issued", v: formatShortDate(invoice.issueDate) },
    { k: "Due date", v: invoice.dueDate ? formatShortDate(invoice.dueDate) : "—" },
  ];

  return (
    <>
      <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[70] bg-[rgba(15,20,32,.4)]" />
      <div className="scroll animate-slide-over fixed inset-y-0 right-0 z-[71] w-[460px] max-w-[92vw] overflow-y-auto border-l border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-border bg-surface px-[22px] py-[18px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-weak text-[20px]">📄</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{invoice.customerName}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-mono text-[11.5px] text-muted">{invoice.invoiceNumber}</span>
              <span
                className="inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-px text-[11.5px] font-bold"
                style={STATUS_STYLE[invoice.status]}
              >
                {STATUS_LABEL[invoice.status]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-[15px] text-text">
            ✕
          </button>
        </div>
        <div className="px-[22px] py-5">
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {facts.map((f) => (
              <div key={f.k} className="bg-surface p-[11px_13px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">{f.k}</div>
                <div className="mt-0.5 truncate text-[13.5px] font-semibold">{f.v}</div>
              </div>
            ))}
          </div>

          {canManage && (
            <div className="mb-5">
              <label className="mb-1.5 block text-[12px] font-semibold text-text-2">Status</label>
              <select
                value={invoice.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusBusy}
                className="h-9 w-full rounded-[9px] border border-border bg-surface px-3 text-[13px] font-semibold text-text outline-none disabled:opacity-60"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-2.5 text-[14px] font-bold">Line items</div>
          <div className="mb-5 flex flex-col gap-2">
            {invoice.items.map((i) => (
              <div key={i.id} className="flex items-center gap-[11px] rounded-[10px] border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{i.description}</div>
                  <div className="text-[11px] text-muted">
                    {i.quantity} × {formatMoney(i.unitPrice)}
                  </div>
                </div>
                <div className="font-mono text-[13px] font-bold">{formatMoney(i.lineTotal)}</div>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface-2 p-3.5 text-[13px]">
            <div className="flex justify-between text-text-2">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(invoice.subtotal)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-text-2">
                <span>Discount</span>
                <span className="font-mono">-{formatMoney(invoice.discountAmount)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-text-2">
                <span>Tax</span>
                <span className="font-mono">{formatMoney(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[15px] font-bold">
              <span>Total</span>
              <span className="font-mono">{formatMoney(invoice.total)}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-5 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text-2">{invoice.notes}</div>
          )}

          <div className="flex gap-2.5">
            <button
              onClick={handleDownload}
              className="relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-accent text-[13px] font-semibold text-white"
            >
              Download PDF
              {!isPremium && <span className="rounded-full bg-white/25 px-1.5 py-px text-[9.5px] font-bold">PRO</span>}
            </button>
            <button
              onClick={handleViewCloudCopy}
              disabled={cloudBusy}
              title="View the last downloaded copy archived to Cloud Storage"
              className="h-9 rounded-[8px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-2 hover:bg-hover disabled:opacity-60"
            >
              ☁️
            </button>
            {canManage && (
              <button
                onClick={handleDelete}
                disabled={deleteBusy}
                className="h-9 rounded-[8px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-red hover:bg-hover disabled:opacity-60"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
