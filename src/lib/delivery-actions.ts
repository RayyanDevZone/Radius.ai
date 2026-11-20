"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { authMember } from "@/db/auth-schema";
import { deliveries, deliveryItems, payments, products, shops, stock, vehicles } from "@/db/schema";
import { AuthContextError, getContext, requireOwner, type TenantContext } from "@/lib/auth-context";
import {
  canMoveTo,
  isDeliveryStatus,
  normalizeDeliveryInput,
  validateDeliveryInput,
  type DeliveryField,
  type DeliveryInput,
  type DeliveryStatus,
} from "@/lib/deliveries";
import { lineTotal, sumMoney } from "@/lib/money";
import { isPaymentMethod, isPositiveMoney, type PaymentMethod } from "@/lib/payments";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";
import { getStoreSelection } from "@/lib/selected-store";

export type SaveDeliveryResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: DeliveryField }
  | { ok: false; error: "no_store" | "forbidden" | "failed" | "not_found" | "locked" };

export type StatusResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "forbidden" | "failed" | "bad_transition" | "invalid_payment" };

async function ownerOrForbidden(): Promise<TenantContext | null> {
  try {
    return await requireOwner();
  } catch (err) {
    if (err instanceof AuthContextError) return null;
    throw err;
  }
}

/**
 * Checks every id in the input against the current business and returns the
 * item rows to insert (name copied from the product, total computed exactly).
 */
type ResolvedInput =
  | { field: DeliveryField }
  | { items: Omit<typeof deliveryItems.$inferInsert, "deliveryId">[]; total: string };

async function resolveInput(orgId: string, input: DeliveryInput): Promise<ResolvedInput | null> {
  const productIds = input.items.map((i) => i.productId);
  if (![input.shopId, input.vehicleId, input.assignedTo, ...productIds].every((id) => id === null || isUuid(id))) return null;

  const [[shop], vehicleRows, memberRows, productRows] = await Promise.all([
    db.select({ id: shops.id }).from(shops).where(and(eq(shops.id, input.shopId), eq(shops.organizationId, orgId))).limit(1),
    input.vehicleId
      ? db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.organizationId, orgId))).limit(1)
      : Promise.resolve([{ id: null }]),
    input.assignedTo
      ? db
          .select({ id: authMember.userId })
          .from(authMember)
          .where(and(eq(authMember.userId, input.assignedTo), eq(authMember.organizationId, orgId)))
          .limit(1)
      : Promise.resolve([{ id: null }]),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.organizationId, orgId))),
  ]);

  if (!shop) return { field: "shopId" };
  if (vehicleRows.length === 0) return { field: "vehicleId" };
  if (memberRows.length === 0) return { field: "assignedTo" };
  if (productRows.length !== productIds.length) return { field: "items" };

  const names = new Map(productRows.map((p) => [p.id, p.name]));
  const items = input.items.map((i) => ({
    organizationId: orgId,
    productId: i.productId,
    productName: names.get(i.productId)!,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: lineTotal(i.unitPrice, i.quantity),
  }));
  const total = sumMoney(items.map((i) => i.lineTotal));
  // numeric(10,2) holds up to 99,999,999.99.
  if (total.replace("-", "").split(".")[0].length > 8) return { field: "items" };
  return { items, total };
}

/** Creates a delivery from the store picked in the side menu. Owners only. */
export async function createDelivery(raw: Record<string, unknown>): Promise<SaveDeliveryResult> {
  const ctx = await ownerOrForbidden();
  if (!ctx) return { ok: false, error: "forbidden" };

  const input = normalizeDeliveryInput(raw ?? {});
  const invalid = validateDeliveryInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  // The store comes from the server-side selection (tenant-checked), never the client.
  const { selected } = await getStoreSelection();
  if (!selected) return { ok: false, error: "no_store" };

  try {
    const resolved = await resolveInput(ctx.orgId, input);
    if (!resolved) return { ok: false, error: "invalid_input", field: "items" };
    if ("field" in resolved) return { ok: false, error: "invalid_input", field: resolved.field };

    await db.transaction(async (tx) => {
      // One number at a time per business, so two saves never get the same #.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`deliveries:${ctx.orgId}`}))`);
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${deliveries.number}), 0) + 1` })
        .from(deliveries)
        .where(eq(deliveries.organizationId, ctx.orgId));

      const [row] = await tx
        .insert(deliveries)
        .values({
          organizationId: ctx.orgId,
          number: Number(next),
          storeId: selected.id,
          shopId: input.shopId,
          vehicleId: input.vehicleId,
          assignedTo: input.assignedTo,
          scheduledFor: input.scheduledFor,
          notes: input.notes,
          total: resolved.total,
          createdBy: ctx.userId,
        })
        .returning({ id: deliveries.id });

      await tx.insert(deliveryItems).values(resolved.items.map((i) => ({ ...i, deliveryId: row.id })));
    });
    return { ok: true };
  } catch (err) {
    console.error("createDelivery failed", err);
    return { ok: false, error: "failed" };
  }
}

/** Edits a pending delivery (details and items). Owners only. */
export async function updateDelivery(id: string, raw: Record<string, unknown>): Promise<SaveDeliveryResult> {
  const ctx = await ownerOrForbidden();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  const input = normalizeDeliveryInput(raw ?? {});
  const invalid = validateDeliveryInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    const resolved = await resolveInput(ctx.orgId, input);
    if (!resolved) return { ok: false, error: "invalid_input", field: "items" };
    if ("field" in resolved) return { ok: false, error: "invalid_input", field: resolved.field };

    return await db.transaction(async (tx): Promise<SaveDeliveryResult> => {
      const [current] = await tx
        .select({ status: deliveries.status })
        .from(deliveries)
        .where(and(eq(deliveries.id, id), eq(deliveries.organizationId, ctx.orgId)))
        .for("update")
        .limit(1);
      if (!current) return { ok: false, error: "not_found" };
      if (current.status !== "pending") return { ok: false, error: "locked" };

      await tx
        .update(deliveries)
        .set({
          shopId: input.shopId,
          vehicleId: input.vehicleId,
          assignedTo: input.assignedTo,
          scheduledFor: input.scheduledFor,
          notes: input.notes,
          total: resolved.total,
        })
        .where(and(eq(deliveries.id, id), eq(deliveries.organizationId, ctx.orgId)));
      await tx.delete(deliveryItems).where(and(eq(deliveryItems.deliveryId, id), eq(deliveryItems.organizationId, ctx.orgId)));
      await tx.insert(deliveryItems).values(resolved.items.map((i) => ({ ...i, deliveryId: id })));
      return { ok: true };
    });
  } catch (err) {
    console.error("updateDelivery failed", err);
    return { ok: false, error: "failed" };
  }
}

/**
 * Moves a delivery to its next status. Owners can change any delivery;
 * employees only the ones assigned to them, and they can't cancel.
 *
 * Marking it delivered also takes its items out of the store's stock and,
 * when `collected` is given, records the payment received on the spot.
 */
export async function setDeliveryStatus(
  id: string,
  to: DeliveryStatus,
  collected?: { amount: string; method: PaymentMethod } | null,
): Promise<StatusResult> {
  let ctx: TenantContext;
  try {
    ctx = await getContext();
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id) || !isDeliveryStatus(to)) return { ok: false, error: "not_found" };
  if (collected && (to !== "delivered" || !isPositiveMoney(String(collected.amount ?? "")) || !isPaymentMethod(collected.method))) {
    return { ok: false, error: "invalid_payment" };
  }

  try {
    return await db.transaction(async (tx): Promise<StatusResult> => {
      const [d] = await tx
        .select({ status: deliveries.status, assignedTo: deliveries.assignedTo, storeId: deliveries.storeId, shopId: deliveries.shopId })
        .from(deliveries)
        .where(and(eq(deliveries.id, id), eq(deliveries.organizationId, ctx.orgId)))
        .for("update")
        .limit(1);
      // Employees can't see other people's deliveries, so treat them as missing.
      if (!d || (ctx.role !== "owner" && d.assignedTo !== ctx.userId)) return { ok: false, error: "not_found" };
      if (!isDeliveryStatus(d.status) || !canMoveTo(d.status, to, ctx.role)) return { ok: false, error: "bad_transition" };

      await tx
        .update(deliveries)
        .set({ status: to, deliveredAt: to === "delivered" ? new Date() : null })
        .where(and(eq(deliveries.id, id), eq(deliveries.organizationId, ctx.orgId)));

      if (to === "delivered") {
        const items = await tx
          .select({ productId: deliveryItems.productId, quantity: deliveryItems.quantity })
          .from(deliveryItems)
          .where(and(eq(deliveryItems.deliveryId, id), eq(deliveryItems.organizationId, ctx.orgId)));
        const lines = items.filter((i): i is { productId: string; quantity: number } => i.productId !== null);
        if (lines.length > 0) {
          await tx
            .insert(stock)
            .values(lines.map((l) => ({ organizationId: ctx.orgId, storeId: d.storeId, productId: l.productId, quantity: -l.quantity })))
            .onConflictDoUpdate({
              target: [stock.storeId, stock.productId],
              set: { quantity: sql`${stock.quantity} + excluded.quantity`, updatedAt: new Date() },
            });
        }
        if (collected) {
          await tx.insert(payments).values({
            organizationId: ctx.orgId,
            shopId: d.shopId,
            deliveryId: id,
            amount: collected.amount,
            method: collected.method,
            receivedBy: ctx.userId,
          });
        }
      }
      return { ok: true };
    });
  } catch (err) {
    console.error("setDeliveryStatus failed", err);
    return { ok: false, error: "failed" };
  }
}

/**
 * Deletes a delivery that never reached the shop (pending or cancelled).
 * Delivered ones stay: they're part of the shop's account. Owners only.
 */
export async function deleteDelivery(id: string): Promise<DeleteResult> {
  const ctx = await ownerOrForbidden();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  try {
    const rows = await db
      .delete(deliveries)
      .where(
        and(eq(deliveries.id, id), eq(deliveries.organizationId, ctx.orgId), inArray(deliveries.status, ["pending", "cancelled"])),
      )
      .returning({ id: deliveries.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("deleteDelivery failed", err);
    return { ok: false, error: "failed" };
  }
}
