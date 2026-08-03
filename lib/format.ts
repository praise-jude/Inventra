export { formatMoney, currencySymbol } from "@/lib/currency";

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0";
  // Explicit locale — toLocaleString() with no argument uses the server's
  // locale during SSR and the browser's locale during hydration, which can
  // disagree on digit grouping (e.g. "1,234" vs "1.234") and throw a
  // hydration mismatch (React error #418) for any non-US-locale visitor.
  return Number(n).toLocaleString("en-US");
}

export function pctDelta(current: number, prior: number | null | undefined): number | null {
  if (prior === null || prior === undefined || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function formatPct(pct: number | null, decimals = 1): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}
