"use client";

import { createContext, useContext, useMemo } from "react";
import { formatMoney, formatMoneyCompact, currencySymbol } from "@/lib/currency";

interface CurrencyApi {
  currency: string;
  symbol: string;
  format: (n: number) => string;
  formatCompact: (n: number) => string;
}

const CurrencyContext = createContext<CurrencyApi>({
  currency: "USD",
  symbol: "$",
  format: (n) => formatMoney(n),
  formatCompact: (n) => formatMoneyCompact(n),
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  const value = useMemo<CurrencyApi>(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      format: (n: number) => formatMoney(n, currency),
      formatCompact: (n: number) => formatMoneyCompact(n, currency),
    }),
    [currency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
