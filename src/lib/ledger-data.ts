import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/auth-schema";
import { deliveries, payments, shops } from "@/db/schema";
import { getContext, requireOwner } from "@/lib/auth-context";
import { CREDIT_DAYS } from "@/lib/deliveries";
import type { PaymentMethod } from "@/lib/payments";

/**
 * The shop credit ledger:
 *   billed      = total of the shop's delivered deliveries
 *   paid        = total of the shop's payments
 *   balance     = billed − paid (what the shop owes; negative = paid in advance)
 *   overdue     = the part of the balance billed more than CREDIT_DAYS ago,
 *                 i.e. max(0, billed before the cut-off − paid). Payments
 *                 clear the oldest deliveries first.
 */
export type ShopBalance = {
  shopId: string;
  firmName: string;
  mobile: string;
  billed: string;
  paid: string;
  balance: string;
  overdue: string;
  lastPaymentOn: string | null;
};

/** Balance of every shop of the business that has deliveries or payments. Any member may read. */
export async function listShopBalances(): Promise<ShopBalance[]> {
  const { orgId } = await getContext();
  const result = await db.execute<{
    shop_id: string;
    firm_name: string;
    mobile: string;
    billed: string;
    paid: string;
    balance: string;
    overdue: string;
    last_payment_on: string | null;
  }>(sql`
    with billed as (
      select shop_id,
             sum(total) as billed,
             sum(total) filter (where delivered_at < now() - make_interval(days => ${CREDIT_DAYS})) as billed_old
        from ${deliveries}
       where organization_id = ${orgId} and status = 'delivered'
       group by shop_id
    ),
    paid as (
      select shop_id, sum(amount) as paid, max(received_on)::text as last_payment_on
        from ${payments}
       where organization_id = ${orgId}
       group by shop_id
    )
    select s.id as shop_id, s.firm_name, s.mobile,
           coalesce(b.billed, 0)::text as billed,
           coalesce(p.paid, 0)::text as paid,
           (coalesce(b.billed, 0) - coalesce(p.paid, 0))::text as balance,
           greatest(coalesce(b.billed_old, 0) - coalesce(p.paid, 0), 0)::text as overdue,
           p.last_payment_on
      from ${shops} s
      left join billed b on b.shop_id = s.id
      left join paid p on p.shop_id = s.id
     where s.organization_id = ${orgId} and (b.shop_id is not null or p.shop_id is not null)
     order by (coalesce(b.billed, 0) - coalesce(p.paid, 0)) desc, s.firm_name
  `);
  return result.rows.map((r) => ({
    shopId: r.shop_id,
    firmName: r.firm_name,
    mobile: r.mobile,
    billed: r.billed,
    paid: r.paid,
    balance: r.balance,
    overdue: r.overdue,
    lastPaymentOn: r.last_payment_on,
  }));
}

export type PaymentRow = {
  id: string;
  shopId: string;
  shopName: string;
  amount: string;
  method: PaymentMethod;
  receivedOn: string;
  receivedByName: string | null;
  deliveryNumber: number | null;
  note: string | null;
};

export const PAYMENT_LIST_LIMIT = 300;

/** Recent payments of the business, newest first. Owners only. */
export async function listPayments(): Promise<PaymentRow[]> {
  const { orgId } = await requireOwner();
  const rows = await db
    .select({
      id: payments.id,
      shopId: payments.shopId,
      shopName: shops.firmName,
      amount: payments.amount,
      method: payments.method,
      receivedOn: payments.receivedOn,
      receivedByName: authUser.name,
      deliveryNumber: deliveries.number,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(shops, eq(shops.id, payments.shopId))
    .leftJoin(authUser, eq(authUser.id, payments.receivedBy))
    .leftJoin(deliveries, and(eq(deliveries.id, payments.deliveryId), eq(deliveries.organizationId, orgId)))
    .where(eq(payments.organizationId, orgId))
    .orderBy(desc(payments.receivedOn), desc(payments.createdAt))
    .limit(PAYMENT_LIST_LIMIT);
  // The check constraint guarantees the method.
  return rows as PaymentRow[];
}
