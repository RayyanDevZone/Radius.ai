// Payment rules. Shared by the payment forms (client) and the server actions.
import { cleanMoney, isMoney, toPaise } from "@/lib/money";

export const PAYMENT_METHODS = ["cash", "upi", "cheque", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);

export const PAYMENT_NOTE_MAX = 200;

export type PaymentInput = { shopId: string; amount: string; method: PaymentMethod; receivedOn: string; note: string | null };
export type PaymentField = keyof PaymentInput;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizePaymentInput(raw: Record<string, unknown>): PaymentInput {
  return {
    shopId: str(raw.shopId),
    amount: cleanMoney(raw.amount),
    method: str(raw.method) as PaymentMethod,
    receivedOn: str(raw.receivedOn),
    note: str(raw.note).replace(/\s+/g, " ") || null,
  };
}

/** A positive amount that fits numeric(10,2). */
export const isPositiveMoney = (s: string) => isMoney(s) && toPaise(s) > BigInt(0);

export function validatePaymentInput(input: PaymentInput, today: string): PaymentField | null {
  if (!input.shopId) return "shopId";
  if (!isPositiveMoney(input.amount)) return "amount";
  if (!isPaymentMethod(input.method)) return "method";
  // A payment can't be dated in the future.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || input.receivedOn > today || input.receivedOn < "2000-01-01") return "receivedOn";
  if (input.note && input.note.length > PAYMENT_NOTE_MAX) return "note";
  return null;
}
