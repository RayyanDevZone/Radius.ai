"use server";

import { cookies } from "next/headers";
import { listStores } from "@/lib/stores-data";
import { SELECTED_STORE_COOKIE } from "@/lib/selected-store";

/**
 * Remembers which store the side-menu picker shows. Only ids of the current
 * business's stores are accepted (listStores() is tenant-scoped through the
 * session). Setting the cookie makes Next.js re-render the current page, so
 * the new store shows up right away.
 */
export async function selectStore(storeId: string): Promise<{ ok: boolean }> {
  const stores = await listStores();
  if (!stores.some((s) => s.id === storeId)) return { ok: false };

  (await cookies()).set(SELECTED_STORE_COOKIE, storeId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
