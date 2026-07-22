const BARS = [38, 52, 45, 63, 58, 74, 69, 85, 78, 92, 88, 100];

export function SalesBars({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-full items-end gap-[6px] ${className}`}>
      {BARS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${h}%`,
            background:
              i === BARS.length - 2
                ? "linear-gradient(180deg, var(--accent), var(--teal))"
                : "var(--accent-weak)",
          }}
        />
      ))}
    </div>
  );
}

const LINE_POINTS = "0,58 20,50 40,54 60,38 80,42 100,26 120,30 140,14 160,20 180,6";

export function RevenueLine({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 64" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,64 ${LINE_POINTS} 180,64`} fill="url(#revenueFill)" />
      <polyline
        points={LINE_POINTS}
        fill="none"
        stroke="var(--teal)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DonutRing({
  percent,
  color = "var(--accent)",
  size = 56,
}: {
  percent: number;
  color?: string;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (percent / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
