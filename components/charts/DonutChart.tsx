const PALETTE = ["#635bff", "#12805c", "#0e7cc4", "#b7791f", "#d5304a", "#8a94a8"];

export function DonutChart({
  data,
  totalLabel,
}: {
  data: { name: string; pct: number }[];
  totalLabel: string;
}) {
  const cx = 65;
  const cy = 65;
  const r = 48;
  const sw = 18;
  const C = 2 * Math.PI * r;

  const arcs = data
    .reduce<{ svg: string; off: number }>(
      (acc, d, i) => {
        const len = C * (Math.max(d.pct, 0) / 100);
        const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc.off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
        return { svg: acc.svg + seg, off: acc.off + len };
      },
      { svg: "", off: 0 },
    )
    .svg;

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <g dangerouslySetInnerHTML={{ __html: arcs }} />
      <text x="65" y="61" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text)" fontFamily="var(--font-mono)">
        {totalLabel}
      </text>
      <text x="65" y="78" textAnchor="middle" fontSize="10.5" fill="var(--muted)">
        total value
      </text>
    </svg>
  );
}
