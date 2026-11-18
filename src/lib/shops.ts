// Shop input rules. Shared by client and server; the server always re-validates.
import { isValidPhone, normalizePhone } from "@/lib/validation";

export type ShopInput = { firmName: string; firmAddress: string; ownerName: string; mobile: string };
export type ShopField = keyof ShopInput;

export const SHOP_LIMITS = {
  firmName: { min: 2, max: 100 },
  firmAddress: { min: 5, max: 300 },
  ownerName: { min: 2, max: 100 },
} as const;

const tidy = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

export function normalizeShopInput(raw: Partial<Record<ShopField, unknown>>): ShopInput {
  return {
    firmName: tidy(raw.firmName),
    firmAddress: tidy(raw.firmAddress),
    ownerName: tidy(raw.ownerName),
    // Same canonical format as business phones: "98765 43210" → "+919876543210".
    mobile: normalizePhone(raw.mobile),
  };
}

const inRange = (s: string, { min, max }: { min: number; max: number }) => s.length >= min && s.length <= max;

/** Returns the first invalid field, or null when the input is valid. */
export function validateShopInput(input: ShopInput): ShopField | null {
  if (!inRange(input.firmName, SHOP_LIMITS.firmName)) return "firmName";
  if (!inRange(input.firmAddress, SHOP_LIMITS.firmAddress)) return "firmAddress";
  if (!inRange(input.ownerName, SHOP_LIMITS.ownerName)) return "ownerName";
  if (!isValidPhone(input.mobile)) return "mobile";
  return null;
}
