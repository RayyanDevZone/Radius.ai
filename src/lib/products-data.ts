import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getContext } from "@/lib/auth-context";
import { sortAlphabetically } from "@/lib/sort";
import type { SaleUnit, SizeUnit } from "@/lib/products";

export type ProductRow = {
  id: string;
  name: string;
  /** numeric(10,2) as a string, e.g. "1250.00". */
  price: string;
  sizeValue: string;
  sizeUnit: SizeUnit;
  unit: SaleUnit | null;
  hsnCode: string | null;
};

/** Products of the current business, sorted A→Z by name. The tenant comes from the session only. */
export async function listProducts(): Promise<ProductRow[]> {
  const { orgId } = await getContext();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      sizeValue: products.sizeValue,
      sizeUnit: products.sizeUnit,
      unit: products.unit,
      hsnCode: products.hsnCode,
    })
    .from(products)
    .where(eq(products.organizationId, orgId));
  // The check constraints guarantee these values.
  return sortAlphabetically(rows as ProductRow[], (r) => r.name);
}
