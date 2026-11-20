"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, shops } from "@/db/schema";
import { AuthContextError, requireOwner, type TenantContext } from "@/lib/auth-context";
import { businessToday } from "@/lib/deliveries";
import { normalizePaymentInput, validatePaymentInput, type PaymentField } from "@/lib/payments";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";

export type RecordPaymentResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: PaymentField }
  | { ok: false; error: "forbidden" | "failed" };

async function ownerOrNull(): Promise<TenantContext | null> {
  try {
    return await requireOwner();
  } catch (err) {
    if (err instanceof AuthContextError) return null;
    throw err;
  }
}

/** Records money received from a shop. Owners only. */
export async function recordPayment(raw: Record<string, unknown>): Promise<RecordPaymentResult> {
  const ctx = await ownerOrNull();
  if (!ctx) return { ok: false, error: "forbidden" };

  const input = normalizePaymentInput(raw ?? {});
  const invalid = validatePaymentInput(input, businessToday());
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };
  if (!isUuid(input.shopId)) return { ok: false, error: "invalid_input", field: "shopId" };

  try {
    const [shop] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(and(eq(shops.id, input.shopId), eq(shops.organizationId, ctx.orgId)))
      .limit(1);
    if (!shop) return { ok: false, error: "invalid_input", field: "shopId" };

    await db.insert(payments).values({
      organizationId: ctx.orgId,
      shopId: input.shopId,
      amount: input.amount,
      method: input.method,
      receivedOn: input.receivedOn,
      note: input.note,
      receivedBy: ctx.userId,
    });
    return { ok: true };
  } catch (err) {
    console.error("recordPayment failed", err);
    return { ok: false, error: "failed" };
  }
}

/** Deletes a payment entered by mistake. Owners only. */
export async function deletePayment(id: string): Promise<DeleteResult> {
  const ctx = await ownerOrNull();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (!isUuid(id)) return { ok: false, error: "not_found" };
  try {
    const rows = await db
      .delete(payments)
      .where(and(eq(payments.id, id), eq(payments.organizationId, ctx.orgId)))
      .returning({ id: payments.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("deletePayment failed", err);
    return { ok: false, error: "failed" };
  }
}
