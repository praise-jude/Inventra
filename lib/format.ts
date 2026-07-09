export { formatMoney, currencySymbol } from "@/lib/currency";

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0";
  return Number(n).toLocaleString();
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
