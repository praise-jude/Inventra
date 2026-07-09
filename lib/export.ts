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
