// Stock rules. Shared by the Adjust stock form (client) and the server action.

export const STOCK_MAX = 1_000_000;

export type StockInput = { productId: string; quantity: number; lowStockAt: number };
export type StockField = "quantity" | "lowStockAt";

const whole = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/,/g, "");
  return /^\d{1,7}$/.test(s) ? Number(s) : NaN;
};

export function normalizeStockInput(raw: Record<string, unknown>): StockInput {
  return { productId: String(raw.productId ?? "").trim(), quantity: whole(raw.quantity), lowStockAt: whole(raw.lowStockAt) };
}

export function validateStockInput(input: StockInput): StockField | null {
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > STOCK_MAX) return "quantity";
  if (!Number.isInteger(input.lowStockAt) || input.lowStockAt < 0 || input.lowStockAt > STOCK_MAX) return "lowStockAt";
  return null;
}

/** Default "low stock" level for products that have no stock row yet (matches the column default). */
export const DEFAULT_LOW_STOCK_AT = 10;
