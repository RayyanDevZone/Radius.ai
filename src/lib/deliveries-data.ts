import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/auth-schema";
import { deliveries, deliveryItems, payments, shops, vehicles } from "@/db/schema";
import { getContext } from "@/lib/auth-context";
import type { DeliveryStatus } from "@/lib/deliveries";

export type DeliveryItemRow = { productId: string | null; productName: string; unitPrice: string; quantity: number; lineTotal: string };

export type DeliveryRow = {
  id: string;
  number: number;
  status: DeliveryStatus;
  scheduledFor: string;
  shopId: string;
  shopName: string;
  vehicleId: string | null;
  vehicleNumber: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  total: string;
  /** Payments recorded on this delivery. */
  collected: string;
  notes: string | null;
  deliveredAt: Date | null;
  items: DeliveryItemRow[];
};

/** How many recent deliveries the list shows. */
export const DELIVERY_LIST_LIMIT = 300;

/**
 * Deliveries of one store, newest first (open ones on top). Owners see all;
 * employees only the deliveries assigned to them. Tenant from the session.
 */
export async function listDeliveries(storeId: string): Promise<DeliveryRow[]> {
  const { orgId, role, userId } = await getContext();
  const collected = db
    .select({ deliveryId: payments.deliveryId, amount: sql<string>`sum(${payments.amount})`.as("amount") })
    .from(payments)
    .where(eq(payments.organizationId, orgId))
    .groupBy(payments.deliveryId)
    .as("collected");

  const rows = await db
    .select({
      id: deliveries.id,
      number: deliveries.number,
      status: deliveries.status,
      scheduledFor: deliveries.scheduledFor,
      shopId: deliveries.shopId,
      shopName: shops.firmName,
      vehicleId: deliveries.vehicleId,
      vehicleNumber: vehicles.number,
      assignedTo: deliveries.assignedTo,
      assigneeName: authUser.name,
      total: deliveries.total,
      collected: sql<string>`coalesce(${collected.amount}, 0)`,
      notes: deliveries.notes,
      deliveredAt: deliveries.deliveredAt,
    })
    .from(deliveries)
    .innerJoin(shops, eq(shops.id, deliveries.shopId))
    .leftJoin(vehicles, eq(vehicles.id, deliveries.vehicleId))
    .leftJoin(authUser, eq(authUser.id, deliveries.assignedTo))
    .leftJoin(collected, eq(collected.deliveryId, deliveries.id))
    .where(
      and(
        eq(deliveries.organizationId, orgId),
        eq(deliveries.storeId, storeId),
        role === "owner" ? undefined : eq(deliveries.assignedTo, userId),
      ),
    )
    .orderBy(
      sql`case ${deliveries.status} when 'out_for_delivery' then 0 when 'pending' then 1 else 2 end`,
      desc(deliveries.scheduledFor),
      desc(deliveries.number),
    )
    .limit(DELIVERY_LIST_LIMIT);

  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select({
          deliveryId: deliveryItems.deliveryId,
          productId: deliveryItems.productId,
          productName: deliveryItems.productName,
          unitPrice: deliveryItems.unitPrice,
          quantity: deliveryItems.quantity,
          lineTotal: deliveryItems.lineTotal,
        })
        .from(deliveryItems)
        .where(and(eq(deliveryItems.organizationId, orgId), inArray(deliveryItems.deliveryId, ids)))
        .orderBy(deliveryItems.productName)
    : [];

  const byDelivery = new Map<string, DeliveryItemRow[]>();
  for (const { deliveryId, ...item } of items) {
    const list = byDelivery.get(deliveryId) ?? [];
    list.push(item);
    byDelivery.set(deliveryId, list);
  }

  return rows.map((r) => ({
    ...r,
    // The check constraint guarantees the status.
    status: r.status as DeliveryStatus,
    collected: String(r.collected),
    items: byDelivery.get(r.id) ?? [],
  }));
}
