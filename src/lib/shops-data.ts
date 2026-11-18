import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { getContext } from "@/lib/auth-context";
import { sortAlphabetically } from "@/lib/sort";

export type ShopRow = { id: string; firmName: string; firmAddress: string; ownerName: string; mobile: string };

/** Shops of the current business, sorted A→Z by firm name. The tenant comes from the session only. */
export async function listShops(): Promise<ShopRow[]> {
  const { orgId } = await getContext();
  const rows = await db
    .select({
      id: shops.id,
      firmName: shops.firmName,
      firmAddress: shops.firmAddress,
      ownerName: shops.ownerName,
      mobile: shops.mobile,
    })
    .from(shops)
    .where(eq(shops.organizationId, orgId));
  return sortAlphabetically(rows, (r) => r.firmName);
}
