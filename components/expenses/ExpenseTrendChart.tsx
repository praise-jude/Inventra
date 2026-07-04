interface Point {
  date: string;
  total: number;
}

export function ExpenseTrendChart({ data }: { data: Point[] }) {
  const w = 560;
  const h = 160;
  const pad = 20;
  const bottom = 20;
  const totals = data.map((d) => d.total);
  const max = Math.max(1, ...totals) * 1.08;

  const X = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - bottom - (v / max) * (h - bottom - 10);
  const line = totals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${X(totals.length - 1).toFixed(1)},${h - bottom} L${X(0).toFixed(1)},${h - bottom} Z`;

  const labels = data
    .map((d, i) => {
      if (i % Math.ceil(data.length / 6 || 1) !== 0) return "";
      const day = new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `<text x="${X(i)}" y="${h - 4}" fill="var(--muted)" font-size="10" text-anchor="middle" font-family="var(--font-mono)">${day}</text>`;
    })
    .join("");

  const svg = `
    <defs>
      <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--amber)" stop-opacity=".24"/><stop offset="1" stop-color="var(--amber)" stop-opacity="0"/></linearGradient>
    </defs>
    <path d="${area}" fill="url(#ge)"/><path d="${line}" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${totals.length ? `<circle cx="${X(totals.length - 1)}" cy="${Y(totals[totals.length - 1])}" r="3.6" fill="var(--amber)" stroke="var(--surface)" stroke-width="2"/>` : ""}
    ${labels}
  `;

  if (data.length === 0) {
    return <div className="flex h-[160px] items-center justify-center text-[12.5px] text-muted">No expenses recorded yet.</div>;
  }

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
