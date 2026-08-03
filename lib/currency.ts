const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "$", AUD: "$", NZD: "$", SGD: "$", HKD: "$", MXN: "$", BZD: "$",
  GBP: "£", EUR: "€", NGN: "₦", GHS: "GH₵", KES: "KSh", ZAR: "R", INR: "₹",
  JPY: "¥", CNY: "¥", CHF: "CHF", AED: "AED", SAR: "SAR", EGP: "E£", PKR: "₨",
  BDT: "৳", PHP: "₱", IDR: "Rp", VND: "₫", THB: "฿", KRW: "₩", TRY: "₺",
  BRL: "R$", NOK: "kr", SEK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč", HUF: "Ft",
  ILS: "₪", TZS: "TSh", UGX: "USh", RWF: "FRw", XOF: "CFA", XAF: "FCFA",
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function formatMoney(n: number, currency: string = "USD"): string {
  const symbol = currencySymbol(currency);
  // Explicit locale, not `undefined` — toLocaleString(undefined, ...) resolves
  // to the server's locale during SSR and the browser's locale during
  // hydration, which can disagree on digit grouping/decimal separator and
  // throw a hydration mismatch (React error #418) for any non-US-locale
  // visitor. Money is rendered on nearly every page, so this is the most
  // likely trigger of that error in this app.
  return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

