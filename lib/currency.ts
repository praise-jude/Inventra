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
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

