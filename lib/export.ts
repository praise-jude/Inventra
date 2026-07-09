"use client";

// Shared client-side export helpers — CSV/Excel/PDF generation all happen in
// the browser from data a server action already returned, same convention as
// the original Products CSV export (dynamic import so these libraries never
// inflate the initial page bundle).

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportToCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const Papa = (await import("papaparse")).default;
  const data = rows.map((row) => {
    const record: Record<string, string | number> = {};
    for (const col of columns) record[col.header] = col.value(row);
    return record;
  });
  const csv = Papa.unparse({ fields: columns.map((c) => c.header), data: data.map((d) => columns.map((c) => d[c.header])) });
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export async function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = "Sheet1") {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(row)])));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export interface ReceiptLine {
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  orgName: string;
  branchName: string | null;
  branchAddress: string | null;
  receiptNumber: string;
  dateTime: string;
  cashierName: string | null;
  customerName: string;
  items: ReceiptLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentSummary: string;
  footer: string | null;
  formatMoney: (n: number) => string;
  paperSize: "58mm" | "80mm" | "a4";
}

// Narrow, receipt-shaped PDF — separate from exportToPdf's generic tabular
// report layout above, but follows the same dynamic-import convention so
// jsPDF/autoTable stay out of every page's initial bundle.
export async function exportReceiptPdf(data: ReceiptData) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const isThermal = data.paperSize !== "a4";
  const widthMm = data.paperSize === "58mm" ? 58 : data.paperSize === "80mm" ? 80 : 210;
  const doc = new jsPDF({
    unit: "mm",
    format: isThermal ? [widthMm, 297] : "a4",
  });

  let y = 10;
  const centerX = widthMm / 2;
  doc.setFontSize(isThermal ? 11 : 16);
  doc.text(data.orgName, centerX, y, { align: "center" });
  y += isThermal ? 5 : 7;
  if (data.branchName) {
    doc.setFontSize(isThermal ? 8 : 10);
    doc.text(data.branchName, centerX, y, { align: "center" });
    y += isThermal ? 4 : 5;
  }
  if (data.branchAddress) {
    doc.setFontSize(isThermal ? 7 : 9);
    doc.text(data.branchAddress, centerX, y, { align: "center" });
    y += isThermal ? 4 : 5;
  }
  y += 2;
  doc.setFontSize(isThermal ? 7.5 : 9.5);
  doc.text(`Receipt: ${data.receiptNumber}`, isThermal ? 4 : 14, y);
  y += isThermal ? 4 : 5;
  doc.text(`Date: ${data.dateTime}`, isThermal ? 4 : 14, y);
  y += isThermal ? 4 : 5;
  if (data.cashierName) {
    doc.text(`Cashier: ${data.cashierName}`, isThermal ? 4 : 14, y);
    y += isThermal ? 4 : 5;
  }
  doc.text(`Customer: ${data.customerName}`, isThermal ? 4 : 14, y);
  y += isThermal ? 3 : 4;

  autoTable(doc, {
    startY: y,
    margin: { left: isThermal ? 3 : 14, right: isThermal ? 3 : 14 },
    head: [["Item", "Qty", "Price", "Total"]],
    body: data.items.map((i) => [i.productName, String(i.qty), data.formatMoney(i.unitPrice), data.formatMoney(i.lineTotal)]),
    styles: { fontSize: isThermal ? 7 : 9, cellPadding: isThermal ? 1 : 2 },
    headStyles: { fillColor: [37, 99, 235] },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + (isThermal ? 3 : 6);
  const totalsX = isThermal ? widthMm - 3 : 196;
  const totalRows: [string, number][] = [
    ["Subtotal", data.subtotal],
    ["Discount", -data.discountAmount],
    ["Tax", data.taxAmount],
  ];
  doc.setFontSize(isThermal ? 7.5 : 9.5);
  for (const [label, amount] of totalRows) {
    doc.text(`${label}: ${data.formatMoney(amount)}`, totalsX, y, { align: "right" });
    y += isThermal ? 4 : 5;
  }
  doc.setFontSize(isThermal ? 9 : 12);
  doc.text(`Total: ${data.formatMoney(data.total)}`, totalsX, y, { align: "right" });
  y += isThermal ? 5 : 6;
  doc.setFontSize(isThermal ? 7.5 : 9.5);
  doc.text(`Payment: ${data.paymentSummary}`, totalsX, y, { align: "right" });
  y += isThermal ? 6 : 8;

  if (data.footer) {
    doc.setFontSize(isThermal ? 7 : 9);
    doc.text(data.footer, centerX, y, { align: "center" });
    y += isThermal ? 4 : 5;
  }
  doc.setFontSize(isThermal ? 7 : 9);
  doc.text("Thank you for your business!", centerX, y, { align: "center" });

  doc.save(`${data.receiptNumber}.pdf`);
}

export async function exportToPdf<T>(title: string, rows: T[], columns: ExportColumn<T>[], filename: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.value(row)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(filename);
}
