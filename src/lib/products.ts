// Product input rules. Shared by the Add product form (client) and the server
// action. The server always re-validates.

export const SIZE_UNITS = ["g", "kg", "ml", "l"] as const;
export const SALE_UNITS = ["bag", "piece", "packet", "crate"] as const;

export type SizeUnit = (typeof SIZE_UNITS)[number];
export type SaleUnit = (typeof SALE_UNITS)[number];

/** Normalized product input. Numbers stay strings so money never touches a JS float. */
export type ProductInput = {
  name: string;
  price: string;
  sizeValue: string;
  sizeUnit: SizeUnit;
  /** Optional. null when left blank. */
  unit: SaleUnit | null;
  /** Optional. null when left blank. */
  hsnCode: string | null;
};

export type ProductField = keyof ProductInput;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "1,250.50" → "1250.50", " 12 " → "12". */
const cleanNumber = (v: unknown) => str(v).trim().replace(/,/g, "");

export function normalizeProductInput(raw: Record<string, unknown>): ProductInput {
  const hsn = str(raw.hsnCode).replace(/[\s.-]/g, "");
  return {
    name: str(raw.name).trim().replace(/\s+/g, " "),
    price: cleanNumber(raw.price),
    sizeValue: cleanNumber(raw.sizeValue),
    sizeUnit: str(raw.sizeUnit) as SizeUnit,
    unit: str(raw.unit).trim() === "" ? null : (str(raw.unit).trim() as SaleUnit),
    hsnCode: hsn === "" ? null : hsn,
  };
}

// numeric(10,2): up to 8 digits before the point, 2 after.
const PRICE_RE = /^\d{1,8}(\.\d{1,2})?$/;
// numeric(10,3): up to 7 digits before the point, 3 after.
const SIZE_RE = /^\d{1,7}(\.\d{1,3})?$/;
// GST HSN codes are 4, 6 or 8 digits.
const HSN_RE = /^(\d{4}|\d{6}|\d{8})$/;

/** Returns the first invalid field, or null when the input is valid. */
export function validateProductInput(input: ProductInput): ProductField | null {
  if (input.name.length < 1 || input.name.length > 120) return "name";
  if (!PRICE_RE.test(input.price)) return "price";
  if (!SIZE_RE.test(input.sizeValue) || Number(input.sizeValue) <= 0) return "sizeValue";
  if (!(SIZE_UNITS as readonly string[]).includes(input.sizeUnit)) return "sizeUnit";
  if (input.unit !== null && !(SALE_UNITS as readonly string[]).includes(input.unit)) return "unit";
  if (input.hsnCode !== null && !HSN_RE.test(input.hsnCode)) return "hsnCode";
  return null;
}
