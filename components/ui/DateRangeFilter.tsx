"use client";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function startOfMonth(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function startOfYear(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), 0, 1));
}

const PRESETS: { label: string; from: () => string }[] = [
  { label: "Today", from: () => isoDate(new Date()) },
  { label: "7 days", from: () => daysAgo(7) },
  { label: "30 days", from: () => daysAgo(30) },
  { label: "This month", from: startOfMonth },
  { label: "This year", from: startOfYear },
];

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const today = isoDate(new Date());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => onChange(e.target.value, to)}
        aria-label="From date"
        className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
      />
      <span className="text-[12.5px] text-muted">to</span>
      <input
        type="date"
        value={to}
        min={from}
        max={today}
        onChange={(e) => onChange(from, e.target.value)}
        aria-label="To date"
        className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[13px] text-text"
      />
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.from(), today)}
            className="h-[37px] rounded-[9px] border border-border bg-surface px-2.5 text-[12.5px] font-semibold text-text-2 hover:bg-hover"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
