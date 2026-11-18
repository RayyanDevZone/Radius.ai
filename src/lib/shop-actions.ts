"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import { normalizeShopInput, validateShopInput, type ShopField } from "@/lib/shops";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";

export type AddShopResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: ShopField }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "failed" };

export type UpdateShopResult = AddShopResult | { ok: false; error: "not_found" };

/**
 * Adds a shop to the current business. Owners only. The tenant comes from the
 * session (requireOwner()), never from the input.
 */
export async function addShop(raw: Record<string, unknown>): Promise<AddShopResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const input = normalizeShopInput(raw ?? {});
  const invalid = validateShopInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    await db.insert(shops).values({ ...input, organizationId: orgId });
  } catch (err) {
    console.error("addShop failed", err);
    return { ok: false, error: "failed" };
  }

  // The popup refreshes the list itself (router.refresh()) after it closes,
  // so a slow page re-render never keeps the Save button spinning.
  return { ok: true };
}

/** Updates one shop of the current business. Owners only; one from another business is "not_found". */
export async function updateShop(id: string, raw: Record<string, unknown>): Promise<UpdateShopResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  const input = normalizeShopInput(raw ?? {});
  const invalid = validateShopInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    const rows = await db
      .update(shops)
      .set(input)
      .where(and(eq(shops.id, id), eq(shops.organizationId, orgId)))
      .returning({ id: shops.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("updateShop failed", err);
    return { ok: false, error: "failed" };
  }
}

/** Deletes one shop of the current business. Owners only. */
export async function deleteShop(id: string): Promise<DeleteResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  try {
    const rows = await db
      .delete(shops)
      .where(and(eq(shops.id, id), eq(shops.organizationId, orgId)))
      .returning({ id: shops.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("deleteShop failed", err);
    return { ok: false, error: "failed" };
  }
}
