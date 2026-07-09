"use client";

import { useEffect, useState } from "react";
import { fetchSaleDetail } from "@/lib/actions/sales";
import type { SaleDetail } from "@/lib/queries/sales";
import { formatMoney as formatMoneyFor } from "@/lib/currency";
import { exportReceiptPdf } from "@/lib/export";
import type { PaymentMethod } from "@/lib/supabase/database.types";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

function paymentSummary(sale: SaleDetail): string {
  if (sale.payments.length === 0) return "—";
  if (sale.payments.length === 1) return PAYMENT_LABEL[sale.payments[0].method];
  return sale.payments.map((p) => PAYMENT_LABEL[p.method]).join(" + ");
}

// Shown right after a sale is recorded (and reachable again from the sale
// detail slide-over) so a cashier can hand over or re-print a receipt.
// Fetches its own SaleDetail from just an id so either caller can use it
// without threading fully-loaded data through.
export function ReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSaleDetail(saleId).then((detail) => {
      if (cancelled) return;
      setSale(detail);
      setLoading(false);
      if (detail?.autoPrint) {
        setTimeout(() => window.print(), 200);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  async function handleDownload() {
    if (!sale) return;
    setDownloading(true);
    try {
      await exportReceiptPdf({
        orgName: sale.orgName,
        branchName: sale.branchName,
        branchAddress: sale.branchAddress,
        receiptNumber: sale.receiptNumber,
        dateTime: new Date(sale.createdAt).toLocaleString(),
        cashierName: sale.cashierName,
        customerName: sale.customerName,
        items: sale.items,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        taxAmount: sale.taxAmount,
        total: sale.total,
        paymentSummary: paymentSummary(sale),
        footer: sale.receiptFooter,
        formatMoney: (n) => formatMoneyFor(n, sale.currency),
        paperSize: sale.paperSize,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:backdrop-blur-none">
      <div className="animate-scale-in flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)] print:max-h-none print:w-auto print:max-w-none print:border-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[16px] print:hidden">
          <div className="text-[16px] font-bold">Receipt</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>

        {loading && <div className="px-[22px] py-10 text-center text-[13px] text-muted">Loading receipt…</div>}

        {!loading && !sale && (
          <div className="px-[22px] py-10 text-center text-[13px] text-muted">Could not load this receipt.</div>
        )}

        {sale && (
          <div id="receipt-print-area" className="scroll overflow-y-auto px-[22px] py-5 text-[13px] print:overflow-visible print:p-4">
            <div className="mb-3 text-center">
              <div className="text-[16px] font-bold">{sale.orgName}</div>
              {sale.branchName && <div className="text-[12px] text-text-2">{sale.branchName}</div>}
              {sale.branchAddress && <div className="text-[11.5px] text-muted">{sale.branchAddress}</div>}
            </div>
            <div className="mb-3 border-t border-dashed border-border pt-3 text-[12px] text-text-2">
              <div className="flex justify-between">
                <span>Receipt #</span>
                <span className="font-mono">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date</span>
                <span>{new Date(sale.createdAt).toLocaleString()}</span>
              </div>
              {sale.cashierName && (
                <div className="flex justify-between">
                  <span>Cashier</span>
                  <span>{sale.cashierName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Customer</span>
                <span>{sale.customerName}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-border pt-3">
              {sale.items.map((i) => (
                <div key={i.id} className="mb-1.5 flex justify-between gap-2">
                  <div>
                    <div className="font-semibold">{i.productName}</div>
                    <div className="text-[11px] text-muted">
                      {i.qty} × {formatMoneyFor(i.unitPrice, sale.currency)}
                    </div>
                  </div>
                  <div className="font-mono font-semibold">{formatMoneyFor(i.lineTotal, sale.currency)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-border pt-3">
              <div className="flex justify-between text-text-2">
                <span>Subtotal</span>
                <span className="font-mono">{formatMoneyFor(sale.subtotal, sale.currency)}</span>
              </div>
              <div className="flex justify-between text-text-2">
                <span>Discount</span>
                <span className="font-mono">-{formatMoneyFor(sale.discountAmount, sale.currency)}</span>
              </div>
              <div className="flex justify-between text-text-2">
                <span>Tax</span>
                <span className="font-mono">{formatMoneyFor(sale.taxAmount, sale.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-[15px] font-bold">
                <span>Total</span>
                <span className="font-mono">{formatMoneyFor(sale.total, sale.currency)}</span>
              </div>
              <div className="flex justify-between text-text-2">
                <span>Payment</span>
                <span>{paymentSummary(sale)}</span>
              </div>
            </div>

            {sale.receiptFooter && (
              <div className="mt-3 border-t border-dashed border-border pt-3 text-center text-[11.5px] text-muted">
                {sale.receiptFooter}
              </div>
            )}
            <div className="mt-2 text-center text-[11.5px] font-semibold text-text-2">Thank you for your business!</div>
          </div>
        )}

        {sale && (
          <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="h-[37px] rounded-[9px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text hover:bg-hover"
            >
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-[37px] rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]"
            >
              Print
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
