import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, stock } from "@/db/schema";
import { getContext } from "@/lib/auth-context";
import { sortAlphabetically } from "@/lib/sort";
import { DEFAULT_LOW_STOCK_AT } from "@/lib/stock";
import type { SaleUnit } from "@/lib/products";

export type StockRow = {
  productId: string;
  name: string;
  unit: SaleUnit | null;
  quantity: number;
  lowStockAt: number;
  /** false = never counted in this store (shown as 0). */
  tracked: boolean;
};

/** Every product of the business with its stock in one store, A→Z. Tenant from the session. */
export async function listStock(storeId: string): Promise<StockRow[]> {
  const { orgId } = await getContext();
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      unit: products.unit,
      quantity: sql<number>`coalesce(${stock.quantity}, 0)`,
      lowStockAt: sql<number>`coalesce(${stock.lowStockAt}, ${DEFAULT_LOW_STOCK_AT})`,
      tracked: sql<boolean>`${stock.productId} is not null`,
    })
    .from(products)
    .leftJoin(stock, and(eq(stock.productId, products.id), eq(stock.storeId, storeId), eq(stock.organizationId, orgId)))
    .where(eq(products.organizationId, orgId));
  return sortAlphabetically(
    rows.map((r) => ({ ...r, unit: r.unit as SaleUnit | null, quantity: Number(r.quantity), lowStockAt: Number(r.lowStockAt) })),
    (r) => r.name,
  );
}
