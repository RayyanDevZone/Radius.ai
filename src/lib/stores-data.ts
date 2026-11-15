import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { getContext } from "@/lib/auth-context";

export type StoreRow = { id: string; name: string; address: string | null };

/** Stores of the current business. The tenant comes from the session only. */
export async function listStores(): Promise<StoreRow[]> {
  const { orgId } = await getContext();
  return db
    .select({ id: stores.id, name: stores.name, address: stores.address })
    .from(stores)
    .where(eq(stores.organizationId, orgId))
    .orderBy(asc(stores.createdAt));
}
