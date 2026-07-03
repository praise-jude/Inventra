interface Point {
  month: string;
  revenue: number;
  profit: number;
}

export function AreaChart({ data }: { data: Point[] }) {
  const w = 560;
  const h = 230;
  const pad = 26;
  const bottom = 26;
  const revenues = data.map((d) => d.revenue);
  const profits = data.map((d) => d.profit);
  const max = Math.max(1, ...revenues, ...profits) * 1.08;

  const X = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - bottom - (v / max) * (h - bottom - 14);
  const line = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = (arr: number[]) =>
    `${line(arr)} L${X(arr.length - 1).toFixed(1)},${h - bottom} L${X(0).toFixed(1)},${h - bottom} Z`;

  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const y = 12 + g * ((h - bottom - 12) / 3);
    grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`;
  }
  const labels = data
    .map((d, i) =>
      i % 2 === 0
        ? `<text x="${X(i)}" y="${h - 8}" fill="var(--muted)" font-size="10.5" text-anchor="middle" font-family="var(--font-mono)">${d.month}</text>`
        : "",
    )
    .join("");

  const svg = `
    <defs>
      <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".26"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
      <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--green)" stop-opacity=".20"/><stop offset="1" stop-color="var(--green)" stop-opacity="0"/></linearGradient>
    </defs>
    ${grid}
    <path d="${area(revenues)}" fill="url(#gr)"/><path d="${line(revenues)}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${area(profits)}" fill="url(#gg)"/><path d="${line(profits)}" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${revenues.length ? `<circle cx="${X(revenues.length - 1)}" cy="${Y(revenues[revenues.length - 1])}" r="3.8" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>` : ""}
    ${profits.length ? `<circle cx="${X(profits.length - 1)}" cy="${Y(profits[profits.length - 1])}" r="3.8" fill="var(--green)" stroke="var(--surface)" stroke-width="2"/>` : ""}
    ${labels}
  `;

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
