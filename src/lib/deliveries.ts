// Delivery rules. Shared by the delivery form (client) and the server
// actions. The server always re-validates.
import { cleanMoney, isMoney } from "@/lib/money";

export const DELIVERY_STATUSES = ["pending", "out_for_delivery", "delivered", "cancelled"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const isDeliveryStatus = (v: unknown): v is DeliveryStatus =>
  typeof v === "string" && (DELIVERY_STATUSES as readonly string[]).includes(v);

/**
 * Allowed status changes. Delivered and cancelled are final.
 * Employees may only move their own deliveries forward (never cancel).
 */
export const NEXT_STATUSES: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  pending: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canMoveTo(from: DeliveryStatus, to: DeliveryStatus, role: "owner" | "employee"): boolean {
  if (!NEXT_STATUSES[from].includes(to)) return false;
  return role === "owner" || to !== "cancelled";
}

/** Shops pay on credit; a delivered amount is overdue after this many days. */
export const CREDIT_DAYS = 30;

/** Business days and "today" are counted in India time. */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/** Today's date in India time, "YYYY-MM-DD". */
export function businessToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const MAX_DELIVERY_ITEMS = 50;
export const MAX_QUANTITY = 100_000;
export const NOTES_MAX = 300;

export type DeliveryItemInput = { productId: string; quantity: number; unitPrice: string };

export type DeliveryInput = {
  shopId: string;
  scheduledFor: string;
  vehicleId: string | null;
  assignedTo: string | null;
  notes: string | null;
  items: DeliveryItemInput[];
};

export type DeliveryField = "shopId" | "scheduledFor" | "vehicleId" | "assignedTo" | "notes" | "items";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const orNull = (v: unknown) => str(v) || null;

export function normalizeDeliveryInput(raw: Record<string, unknown>): DeliveryInput {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  return {
    shopId: str(raw.shopId),
    scheduledFor: str(raw.scheduledFor),
    vehicleId: orNull(raw.vehicleId),
    assignedTo: orNull(raw.assignedTo),
    notes: orNull(str(raw.notes).replace(/\s+/g, " ")),
    items: rawItems.slice(0, MAX_DELIVERY_ITEMS + 1).map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const q = str(String(o.quantity ?? ""));
      return {
        productId: str(o.productId),
        quantity: /^\d{1,6}$/.test(q) ? Number(q) : NaN,
        unitPrice: cleanMoney(o.unitPrice),
      };
    }),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Returns the first invalid field, or null. Ids are checked against the business on the server. */
export function validateDeliveryInput(input: DeliveryInput): DeliveryField | null {
  if (!input.shopId) return "shopId";
  if (!isRealDate(input.scheduledFor)) return "scheduledFor";
  if (input.notes && input.notes.length > NOTES_MAX) return "notes";
  if (input.items.length === 0 || input.items.length > MAX_DELIVERY_ITEMS) return "items";
  const seen = new Set<string>();
  for (const it of input.items) {
    if (!it.productId || seen.has(it.productId)) return "items";
    seen.add(it.productId);
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > MAX_QUANTITY) return "items";
    if (!isMoney(it.unitPrice)) return "items";
  }
  return null;
}
