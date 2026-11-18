"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import { normalizeProductInput, validateProductInput, type ProductField } from "@/lib/products";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";

export type AddProductResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: ProductField }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "failed" };

export type UpdateProductResult = AddProductResult | { ok: false; error: "not_found" };

/**
 * Adds a product to the current business. Owners only. The tenant comes from
 * the session (requireOwner()), never from the input.
 */
export async function addProduct(raw: Record<string, unknown>): Promise<AddProductResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const input = normalizeProductInput(raw ?? {});
  const invalid = validateProductInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    await db.insert(products).values({ ...input, organizationId: orgId });
  } catch (err) {
    console.error("addProduct failed", err);
    return { ok: false, error: "failed" };
  }

  // The popup refreshes the list itself (router.refresh()) after it closes,
  // so a slow page re-render never keeps the Save button spinning.
  return { ok: true };
}

/** Updates one product of the current business. Owners only; one from another business is "not_found". */
export async function updateProduct(id: string, raw: Record<string, unknown>): Promise<UpdateProductResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  const input = normalizeProductInput(raw ?? {});
  const invalid = validateProductInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    const rows = await db
      .update(products)
      .set(input)
      .where(and(eq(products.id, id), eq(products.organizationId, orgId)))
      .returning({ id: products.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("updateProduct failed", err);
    return { ok: false, error: "failed" };
  }
}

/** Deletes one product of the current business. Owners only. */
export async function deleteProduct(id: string): Promise<DeleteResult> {
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
      .delete(products)
      .where(and(eq(products.id, id), eq(products.organizationId, orgId)))
      .returning({ id: products.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("deleteProduct failed", err);
    return { ok: false, error: "failed" };
  }
}
