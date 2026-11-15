import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { listStores, type StoreRow } from "@/lib/stores-data";

/** Cookie holding the id of the store picked in the side menu. */
export const SELECTED_STORE_COOKIE = "store";

/**
 * The current business's stores plus the one picked in the side menu.
 *
 * The cookie is only a preference: the id is accepted only if it belongs to
 * the current business (listStores() is tenant-scoped). Otherwise, or when
 * nothing was picked yet, the first store is used. `selected` is null only
 * when the business has no stores. Cached per request.
 *
 * Pages that show per-store data should read the store from here, never from
 * the URL or a request body.
 */
export const getStoreSelection = cache(
  async (): Promise<{ stores: StoreRow[]; selected: StoreRow | null }> => {
    const [stores, cookieStore] = await Promise.all([listStores(), cookies()]);
    const wanted = cookieStore.get(SELECTED_STORE_COOKIE)?.value;
    const selected = stores.find((s) => s.id === wanted) ?? stores[0] ?? null;
    return { stores, selected };
  },
);
