"use client";

import { createContext, useContext, useMemo } from "react";
import { formatMoney, currencySymbol } from "@/lib/currency";
import { formatShortDate, formatLongDate, formatDateTime } from "@/lib/datetime";

interface WorkspaceApi {
  currency: string;
  symbol: string;
  format: (n: number) => string;
  timezone: string;
  formatShortDate: (iso: string) => string;
  formatLongDate: (iso: string) => string;
  formatDateTime: (iso: string) => string;
}

const WorkspaceContext = createContext<WorkspaceApi>({
  currency: "USD",
  symbol: "$",
  format: (n) => formatMoney(n),
  timezone: "UTC",
  formatShortDate: (iso) => formatShortDate(iso, "UTC"),
  formatLongDate: (iso) => formatLongDate(iso, "UTC"),
  formatDateTime: (iso) => formatDateTime(iso, "UTC"),
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({
  currency,
  timezone,
  children,
}: {
  currency: string;
  timezone: string;
  children: React.ReactNode;
}) {
  const value = useMemo<WorkspaceApi>(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      format: (n: number) => formatMoney(n, currency),
      timezone,
      formatShortDate: (iso: string) => formatShortDate(iso, timezone),
      formatLongDate: (iso: string) => formatLongDate(iso, timezone),
      formatDateTime: (iso: string) => formatDateTime(iso, timezone),
    }),
    [currency, timezone],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
