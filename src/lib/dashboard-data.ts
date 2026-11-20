import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { BUSINESS_TIME_ZONE, CREDIT_DAYS } from "@/lib/deliveries";
import { sumMoney } from "@/lib/money";
import type { SaleUnit } from "@/lib/products";

/**
 * Numbers for the dashboard home. Every function takes the tenant id from
 * the caller, who must get it from getContext() (never from the client).
 *
 * `storeId` = one store, or null for all stores of the business. Sales and
 * deliveries follow it; shops, payments and balances belong to the business
 * as a whole, so they never do.
 *
 * Days are business days in India time. Sales count on the day a delivery
 * was delivered.
 */

const TZ = sql.raw(`'${BUSINESS_TIME_ZONE}'`);
const TODAY = sql`(now() at time zone ${TZ})::date`;
const localDate = (col: SQL) => sql`(${col} at time zone ${TZ})::date`;
/** A constant day count, inlined so `date - n` isn't an ambiguous operator on an untyped parameter. */
const n = (days: number) => sql.raw(String(Math.trunc(days)));
const storeFilter = (storeId: string | null, alias = "d") =>
  storeId ? sql`and ${sql.raw(alias)}.store_id = ${storeId}` : sql``;

/** Rows from db.execute, typed. */
async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

/* ------------------------------------------------------------------ */
/* Overview cards + setup checklist                                   */
/* ------------------------------------------------------------------ */

export type CountKey = "shops" | "products" | "vehicles" | "employees" | "stores" | "deliveries";
export type Overview = Record<CountKey, { total: number; thisMonth: number }>;

export async function getOverview(orgId: string): Promise<Overview> {
  const monthStart = sql`date_trunc('month', ${TODAY})::date`;
  const count = (table: string, createdCol = "created_at", extra = sql``) => sql`
    (select json_build_object(
       'total', count(*),
       'thisMonth', count(*) filter (where ${localDate(sql.raw(createdCol))} >= ${monthStart})
     ) from ${sql.raw(table)} where organization_id = ${orgId} ${extra})`;

  const [r] = await rows<Record<CountKey, { total: number; thisMonth: number }>>(sql`
    select
      ${count("shops")} as shops,
      ${count("products")} as products,
      ${count("vehicles")} as vehicles,
      ${count("stores")} as stores,
      ${count("deliveries")} as deliveries,
      (select json_build_object(
         'total', count(*),
         'thisMonth', count(*) filter (where ${localDate(sql`m."createdAt"`)} >= ${monthStart})
       ) from neon_auth.member m where m."organizationId" = ${orgId} and m.role <> 'owner') as employees
  `);
  return r;
}

/* ------------------------------------------------------------------ */
/* Today                                                              */
/* ------------------------------------------------------------------ */

export type TodayStats = {
  /** Deliveries planned for today, by status. */
  planned: { pending: number; out_for_delivery: number; delivered: number; cancelled: number };
  /** Delivered today (whatever day they were planned for). */
  deliveredCount: number;
  salesToday: string;
  /** Payments received today, all stores. */
  collectedToday: string;
  /** Older deliveries still not delivered. */
  overdueOpen: number;
};

export async function getToday(orgId: string, storeId: string | null): Promise<TodayStats> {
  const [r] = await rows<{
    pending: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    delivered_count: number;
    sales_today: string;
    collected_today: string;
    overdue_open: number;
  }>(sql`
    select
      count(*) filter (where d.scheduled_for = ${TODAY} and d.status = 'pending')::int as pending,
      count(*) filter (where d.scheduled_for = ${TODAY} and d.status = 'out_for_delivery')::int as out_for_delivery,
      count(*) filter (where d.scheduled_for = ${TODAY} and d.status = 'delivered')::int as delivered,
      count(*) filter (where d.scheduled_for = ${TODAY} and d.status = 'cancelled')::int as cancelled,
      count(*) filter (where d.status = 'delivered' and ${localDate(sql`d.delivered_at`)} = ${TODAY})::int as delivered_count,
      coalesce(sum(d.total) filter (where d.status = 'delivered' and ${localDate(sql`d.delivered_at`)} = ${TODAY}), 0)::text as sales_today,
      count(*) filter (where d.scheduled_for < ${TODAY} and d.status in ('pending', 'out_for_delivery'))::int as overdue_open,
      (select coalesce(sum(amount), 0)::text from payments where organization_id = ${orgId} and received_on = ${TODAY}) as collected_today
    from deliveries d
    where d.organization_id = ${orgId} ${storeFilter(storeId)}
  `);
  return {
    planned: { pending: r.pending, out_for_delivery: r.out_for_delivery, delivered: r.delivered, cancelled: r.cancelled },
    deliveredCount: r.delivered_count,
    salesToday: r.sales_today,
    collectedToday: r.collected_today,
    overdueOpen: r.overdue_open,
  };
}

/* ------------------------------------------------------------------ */
/* Sales trend                                                        */
/* ------------------------------------------------------------------ */

export const TREND_DAYS = 30;

export type SalesTrend = {
  days: { date: string; total: string; count: number }[];
  total: string;
  /** Same length window just before, for the % change. */
  previousTotal: string;
};

export async function getSalesTrend(orgId: string, storeId: string | null): Promise<SalesTrend> {
  const days = await rows<{ date: string; total: string; count: number }>(sql`
    with days as (
      select generate_series(${TODAY} - ${n(TREND_DAYS - 1)}, ${TODAY}, interval '1 day')::date as day
    ),
    sales as (
      select ${localDate(sql`d.delivered_at`)} as day, sum(d.total) as total, count(*)::int as count
        from deliveries d
       where d.organization_id = ${orgId} and d.status = 'delivered'
         and d.delivered_at >= (${TODAY} - ${n(TREND_DAYS)})::timestamp at time zone ${TZ}
         ${storeFilter(storeId)}
       group by 1
    )
    select days.day::text as date, coalesce(sales.total, 0)::text as total, coalesce(sales.count, 0) as count
      from days left join sales on sales.day = days.day
     order by days.day
  `);
  const [prev] = await rows<{ total: string }>(sql`
    select coalesce(sum(d.total), 0)::text as total
      from deliveries d
     where d.organization_id = ${orgId} and d.status = 'delivered'
       and ${localDate(sql`d.delivered_at`)} between ${TODAY} - ${n(TREND_DAYS * 2 - 1)} and ${TODAY} - ${n(TREND_DAYS)}
       ${storeFilter(storeId)}
  `);
  const [cur] = await rows<{ total: string }>(sql`
    select coalesce(sum(d.total), 0)::text as total
      from deliveries d
     where d.organization_id = ${orgId} and d.status = 'delivered'
       and ${localDate(sql`d.delivered_at`)} between ${TODAY} - ${n(TREND_DAYS - 1)} and ${TODAY}
       ${storeFilter(storeId)}
  `);
  return { days, total: cur.total, previousTotal: prev.total };
}

/* ------------------------------------------------------------------ */
/* Top products / shops, shops gone quiet                             */
/* ------------------------------------------------------------------ */

export type TopProduct = { name: string; unit: SaleUnit | null; quantity: number; revenue: string };
export type TopShop = { shopId: string; name: string; deliveries: number; revenue: string };
export type QuietShop = { shopId: string; name: string; mobile: string; lastOrderOn: string | null };

const RECENT = sql`d.delivered_at >= now() - make_interval(days => ${TREND_DAYS})`;

export async function getTopProducts(orgId: string, storeId: string | null, limit = 5): Promise<TopProduct[]> {
  return rows<TopProduct>(sql`
    select max(i.product_name) as name, max(p.unit) as unit, sum(i.quantity)::int as quantity, sum(i.line_total)::text as revenue
      from delivery_items i
      join deliveries d on d.id = i.delivery_id
      left join products p on p.id = i.product_id
     where i.organization_id = ${orgId} and d.organization_id = ${orgId}
       and d.status = 'delivered' and ${RECENT} ${storeFilter(storeId)}
     group by coalesce(i.product_id::text, i.product_name)
     order by sum(i.line_total) desc
     limit ${limit}
  `);
}

export async function getTopShops(orgId: string, storeId: string | null, limit = 5): Promise<TopShop[]> {
  return rows<TopShop>(sql`
    select s.id as "shopId", s.firm_name as name, count(*)::int as deliveries, sum(d.total)::text as revenue
      from deliveries d
      join shops s on s.id = d.shop_id
     where d.organization_id = ${orgId} and d.status = 'delivered' and ${RECENT} ${storeFilter(storeId)}
     group by s.id, s.firm_name
     order by sum(d.total) desc
     limit ${limit}
  `);
}

/** Shops with no delivery (from any store) in the last QUIET_DAYS days, longest-quiet first. */
export const QUIET_DAYS = 30;

export async function getQuietShops(orgId: string, limit = 5): Promise<{ count: number; shops: QuietShop[] }> {
  const list = await rows<QuietShop & { total: number }>(sql`
    with last as (
      select shop_id, max(scheduled_for) as last_order_on
        from deliveries
       where organization_id = ${orgId} and status <> 'cancelled'
       group by shop_id
    )
    select s.id as "shopId", s.firm_name as name, s.mobile, last.last_order_on::text as "lastOrderOn",
           count(*) over ()::int as total
      from shops s
      left join last on last.shop_id = s.id
     where s.organization_id = ${orgId}
       and (last.last_order_on is null or last.last_order_on < ${TODAY} - ${n(QUIET_DAYS)})
     order by last.last_order_on asc nulls last, s.firm_name
     limit ${limit}
  `);
  return { count: list[0]?.total ?? 0, shops: list.map((r) => ({ shopId: r.shopId, name: r.name, mobile: r.mobile, lastOrderOn: r.lastOrderOn })) };
}

/* ------------------------------------------------------------------ */
/* Outstanding payments                                               */
/* ------------------------------------------------------------------ */

export type Outstanding = {
  /** Sum of positive balances (what shops owe). */
  totalDue: string;
  overdue: string;
  shopsOwing: number;
  shopsOverdue: number;
  top: { shopId: string; name: string; mobile: string; balance: string; overdue: string }[];
};

export async function getOutstanding(orgId: string, limit = 5): Promise<Outstanding> {
  const balances = await rows<{ shopId: string; name: string; mobile: string; balance: string; overdue: string }>(sql`
    with billed as (
      select shop_id, sum(total) as billed,
             sum(total) filter (where delivered_at < now() - make_interval(days => ${CREDIT_DAYS})) as billed_old
        from deliveries
       where organization_id = ${orgId} and status = 'delivered'
       group by shop_id
    ),
    paid as (
      select shop_id, sum(amount) as paid from payments where organization_id = ${orgId} group by shop_id
    )
    select s.id as "shopId", s.firm_name as name, s.mobile,
           (b.billed - coalesce(p.paid, 0))::text as balance,
           greatest(coalesce(b.billed_old, 0) - coalesce(p.paid, 0), 0)::text as overdue
      from billed b
      join shops s on s.id = b.shop_id and s.organization_id = ${orgId}
      left join paid p on p.shop_id = b.shop_id
     where b.billed - coalesce(p.paid, 0) > 0
     order by greatest(coalesce(b.billed_old, 0) - coalesce(p.paid, 0), 0) desc, b.billed - coalesce(p.paid, 0) desc
  `);
  return {
    totalDue: sumMoney(balances.map((b) => b.balance)),
    overdue: sumMoney(balances.map((b) => b.overdue)),
    shopsOwing: balances.length,
    shopsOverdue: balances.filter((b) => Number(b.overdue) > 0).length,
    top: balances.slice(0, limit),
  };
}

/* ------------------------------------------------------------------ */
/* Vehicles and employees                                             */
/* ------------------------------------------------------------------ */

export type VehicleActivity = { id: string; number: string; type: string; onRoad: boolean; plannedToday: number; delivered30: number };

export async function getVehicleActivity(orgId: string, storeId: string | null): Promise<VehicleActivity[]> {
  return rows<VehicleActivity>(sql`
    select v.id, v.number, v.type,
           coalesce(bool_or(d.status = 'out_for_delivery'), false) as "onRoad",
           (count(*) filter (where d.scheduled_for = ${TODAY} and d.status <> 'cancelled'))::int as "plannedToday",
           (count(*) filter (where d.status = 'delivered' and ${RECENT}))::int as "delivered30"
      from vehicles v
      left join deliveries d on d.vehicle_id = v.id and d.organization_id = ${orgId} ${storeFilter(storeId)}
     where v.organization_id = ${orgId}
     group by v.id, v.number, v.type
     order by 4 desc, 6 desc, v.number
  `);
}

export type EmployeeActivity = {
  userId: string;
  name: string;
  designation: string | null;
  outNow: boolean;
  openToday: number;
  delivered30: number;
  collected30: string;
};

export async function getEmployeeActivity(orgId: string, storeId: string | null): Promise<EmployeeActivity[]> {
  return rows<EmployeeActivity>(sql`
    with e as (
      select m."userId" as user_id, u.name, ep.designation
        from neon_auth.member m
        join neon_auth."user" u on u.id = m."userId"
        left join employee_profile ep on ep.user_id = m."userId" and ep.organization_id = ${orgId}
       where m."organizationId" = ${orgId} and m.role <> 'owner'
    ),
    work as (
      select d.assigned_to as user_id,
             bool_or(d.status = 'out_for_delivery') as out_now,
             count(*) filter (where d.scheduled_for <= ${TODAY} and d.status in ('pending', 'out_for_delivery'))::int as open_today,
             count(*) filter (where d.status = 'delivered' and ${RECENT})::int as delivered30
        from deliveries d
       where d.organization_id = ${orgId} and d.assigned_to is not null ${storeFilter(storeId)}
       group by d.assigned_to
    ),
    cash as (
      select received_by as user_id, sum(amount) as collected30
        from payments
       where organization_id = ${orgId} and received_on > ${TODAY} - ${n(TREND_DAYS)}
       group by received_by
    )
    select e.user_id as "userId", e.name, e.designation,
           coalesce(work.out_now, false) as "outNow",
           coalesce(work.open_today, 0) as "openToday",
           coalesce(work.delivered30, 0) as "delivered30",
           coalesce(cash.collected30, 0)::text as "collected30"
      from e
      left join work on work.user_id = e.user_id
      left join cash on cash.user_id = e.user_id
     order by 4 desc, 6 desc, e.name
  `);
}

/* ------------------------------------------------------------------ */
/* Low stock                                                          */
/* ------------------------------------------------------------------ */

export type LowStockRow = { productId: string; name: string; unit: SaleUnit | null; storeName: string; quantity: number; lowStockAt: number };

export async function getLowStock(orgId: string, storeId: string | null, limit = 6): Promise<{ count: number; items: LowStockRow[] }> {
  const list = await rows<LowStockRow & { total: number }>(sql`
    select p.id as "productId", p.name, p.unit, st.name as "storeName", s.quantity, s.low_stock_at as "lowStockAt",
           count(*) over ()::int as total
      from stock s
      join products p on p.id = s.product_id
      join stores st on st.id = s.store_id
     where s.organization_id = ${orgId} and s.quantity <= s.low_stock_at ${storeFilter(storeId, "s")}
     order by s.quantity - s.low_stock_at, p.name
     limit ${limit}
  `);
  return { count: list[0]?.total ?? 0, items: list.map((r) => ({
      productId: r.productId,
      name: r.name,
      unit: r.unit,
      storeName: r.storeName,
      quantity: r.quantity,
      lowStockAt: r.lowStockAt,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* An employee's own day                                              */
/* ------------------------------------------------------------------ */

export type MyDelivery = { id: string; number: number; status: string; scheduledFor: string; shopName: string; shopAddress: string; storeName: string; total: string };
export type MyDay = { open: MyDelivery[]; deliveredToday: number; salesToday: string; collectedToday: string };

/** Deliveries assigned to this user (any store), plus today's totals. */
export async function getMyDay(orgId: string, userId: string): Promise<MyDay> {
  const [open, [stats]] = await Promise.all([
    rows<MyDelivery>(sql`
      select d.id, d.number, d.status, d.scheduled_for::text as "scheduledFor", s.firm_name as "shopName",
             s.firm_address as "shopAddress", st.name as "storeName", d.total::text as total
        from deliveries d
        join shops s on s.id = d.shop_id
        join stores st on st.id = d.store_id
       where d.organization_id = ${orgId} and d.assigned_to = ${userId}
         and d.status in ('pending', 'out_for_delivery') and d.scheduled_for <= ${TODAY}
       order by case d.status when 'out_for_delivery' then 0 else 1 end, d.scheduled_for, d.number
       limit 20
    `),
    rows<{ delivered_today: number; sales_today: string; collected_today: string }>(sql`
      select
        (select count(*)::int from deliveries d where d.organization_id = ${orgId} and d.assigned_to = ${userId}
            and d.status = 'delivered' and ${localDate(sql`d.delivered_at`)} = ${TODAY}) as delivered_today,
        (select coalesce(sum(d.total), 0)::text from deliveries d where d.organization_id = ${orgId} and d.assigned_to = ${userId}
            and d.status = 'delivered' and ${localDate(sql`d.delivered_at`)} = ${TODAY}) as sales_today,
        (select coalesce(sum(amount), 0)::text from payments where organization_id = ${orgId} and received_by = ${userId}
            and received_on = ${TODAY}) as collected_today
    `),
  ]);
  return { open, deliveredToday: stats.delivered_today, salesToday: stats.sales_today, collectedToday: stats.collected_today };
}
