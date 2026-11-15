"use server";

import { db } from "@/db";
import { stores } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";

export type AddStoreResult =
  | { ok: true }
  | { ok: false; error: "invalid_name" | "duplicate_name" | "forbidden" | "failed" };

/** Owner-only. Adds a store to the current business. */
export async function addStore(raw: { name: string; address?: string }): Promise<AddStoreResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const name = String(raw?.name ?? "").trim().replace(/\s+/g, " ");
  const address = String(raw?.address ?? "").trim() || null;
  if (name.length < 2 || name.length > 100 || (address && address.length > 300)) {
    return { ok: false, error: "invalid_name" };
  }

  try {
    await db.insert(stores).values({ organizationId: orgId, name, address });
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if ((e.cause?.code ?? e.code) === "23505") return { ok: false, error: "duplicate_name" };
    console.error("[addStore] failed", err);
    return { ok: false, error: "failed" };
  }
}
