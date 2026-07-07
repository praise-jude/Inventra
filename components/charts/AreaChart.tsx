interface Series {
  key: string;
  color: string;
  values: number[];
}

export function AreaChart({
  months,
  series,
  idPrefix = "ac",
  height = 230,
}: {
  months: string[];
  series: Series[];
  idPrefix?: string;
  height?: number;
}) {
  const w = 560;
  const h = height;
  const pad = 26;
  const bottom = 26;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues) * 1.08;

  const X = (i: number) => pad + (i / Math.max(1, months.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - bottom - (v / max) * (h - bottom - 14);
  const line = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = (arr: number[]) =>
    `${line(arr)} L${X(arr.length - 1).toFixed(1)},${h - bottom} L${X(0).toFixed(1)},${h - bottom} Z`;

  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const y = 12 + g * ((h - bottom - 12) / 3);
    grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`;
  }
  const labels = months
    .map((m, i) =>
      i % 2 === 0
        ? `<text x="${X(i)}" y="${h - 8}" fill="var(--muted)" font-size="10.5" text-anchor="middle" font-family="var(--font-mono)">${m}</text>`
        : "",
    )
    .join("");

  const defs = series
    .map(
      (s) =>
        `<linearGradient id="${idPrefix}-${s.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".24"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`,
    )
    .join("");

  const paths = series
    .map((s) => {
      const last = s.values.length
        ? `<circle cx="${X(s.values.length - 1)}" cy="${Y(s.values[s.values.length - 1])}" r="3.8" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`
        : "";
      return `<path d="${area(s.values)}" fill="url(#${idPrefix}-${s.key})"/><path d="${line(s.values)}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${last}`;
    })
    .join("");

  const svg = `<defs>${defs}</defs>${grid}${paths}${labels}`;

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
