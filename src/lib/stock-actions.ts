"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, stock } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import { isUuid } from "@/lib/row-action-result";
import { getStoreSelection } from "@/lib/selected-store";
import { normalizeStockInput, validateStockInput, type StockField } from "@/lib/stock";

export type SetStockResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: StockField }
  | { ok: false; error: "forbidden" | "failed" | "not_found" | "no_store" };

/**
 * Sets the counted quantity and low-stock level of one product in the store
 * picked in the side menu. Owners only.
 */
export async function setStock(raw: Record<string, unknown>): Promise<SetStockResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const input = normalizeStockInput(raw ?? {});
  const invalid = validateStockInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };
  if (!isUuid(input.productId)) return { ok: false, error: "not_found" };

  const { selected } = await getStoreSelection();
  if (!selected) return { ok: false, error: "no_store" };

  try {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.organizationId, orgId)))
      .limit(1);
    if (!product) return { ok: false, error: "not_found" };

    await db
      .insert(stock)
      .values({ organizationId: orgId, storeId: selected.id, productId: product.id, quantity: input.quantity, lowStockAt: input.lowStockAt })
      .onConflictDoUpdate({
        target: [stock.storeId, stock.productId],
        set: { quantity: input.quantity, lowStockAt: input.lowStockAt, updatedAt: new Date() },
      });
    return { ok: true };
  } catch (err) {
    console.error("setStock failed", err);
    return { ok: false, error: "failed" };
  }
}
