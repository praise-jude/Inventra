// Shared by lib/actions/invoices.ts's Server Actions and
// app/api/mobile/invoices/[id]/{archive-pdf,pdf-url}'s Route Handlers.
// Kept out of invoices.ts itself because every export of a "use server"
// file must be an async function — this is a plain sync helper.
export function invoicePdfStoragePath(orgId: string, invoiceId: string): string {
  return `${orgId}/invoices/${invoiceId}.pdf`;
}
