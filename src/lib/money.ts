// Exact money helpers. Amounts travel as strings ("1250.50", like Drizzle's
// numeric) and are added up as whole paise in BigInt, so a JS float never
// touches a stored amount. Shared by client and server.

/** numeric(10,2): up to 8 digits before the point, 2 after. */
const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

/** "1,250.5" → "1250.5", " 12 " → "12". Doesn't validate. */
export const cleanMoney = (v: unknown) => (typeof v === "string" ? v : String(v ?? "")).trim().replace(/[,₹\s]/g, "");

export const isMoney = (s: string) => MONEY_RE.test(s);

/** "1250.5" → 125050n. Accepts a leading "-" (sums can be negative). */
export function toPaise(amount: string): bigint {
  const neg = amount.startsWith("-");
  const [whole, frac = ""] = (neg ? amount.slice(1) : amount).split(".");
  const paise = BigInt(whole || "0") * BigInt(100) + BigInt((frac + "00").slice(0, 2));
  return neg ? -paise : paise;
}

/** 125050n → "1250.50" */
export function fromPaise(paise: bigint): string {
  const neg = paise < BigInt(0);
  const abs = neg ? -paise : paise;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** price × quantity, exactly. */
export const lineTotal = (unitPrice: string, quantity: number) => fromPaise(toPaise(unitPrice) * BigInt(quantity));

/** Sum of money strings, exactly. */
export const sumMoney = (amounts: readonly string[]) => fromPaise(amounts.reduce((acc, a) => acc + toPaise(a), BigInt(0)));

/** ₹ formatter for the current locale. Display only. */
export function moneyFormatter(locale: string, compact = false) {
  const nf = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  });
  return (amount: string | number) => nf.format(Number(amount));
}
