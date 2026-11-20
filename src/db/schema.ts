import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { money, organizationId, tenantIndex } from "./tenant";

/**
 * App-owned tables (public schema). Every business table carries a non-null,
 * indexed organization_id. See CONVENTIONS.md.
 */

/**
 * Extra business fields for an organization. Managed Neon Auth does not allow
 * custom columns on neon_auth.organization, so they live here, one row per org.
 * organization_id is the primary key, which also serves as its index.
 *
 * One organization = one owner's business account. business_phone is the
 * owner's login phone: stored normalized (see normalizePhone: leading + and
 * digits only) and unique across all businesses. Stores don't have their own
 * login phone.
 */
export const organizationProfile = pgTable(
  "organization_profile",
  {
    organizationId: organizationId().primaryKey(),
    businessPhone: text("business_phone"),
    whatsappNumber: text("whatsapp_number"),
    telegramChatId: text("telegram_chat_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("organization_profile_business_phone_key").on(t.businessPhone)],
);

/**
 * A store / branch / depot of a business. An owner runs one business account
 * (organization) with any number of stores; the dashboard lists them under
 * "Stores".
 */
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    tenantIndex("stores", t.organizationId),
    // Store names are unique within a business, not globally.
    uniqueIndex("stores_organization_id_name_key").on(t.organizationId, t.name),
  ],
);

/**
 * A product the business sells. Products belong to the business (all its
 * stores share one catalogue).
 *
 *   size_value + size_unit  pack size, e.g. 25 kg, 500 g, 1 l, 200 ml
 *   unit                    how it's sold/counted: bag, piece, packet or crate
 *   hsn_code                optional GST HSN code (4, 6 or 8 digits)
 *
 * Allowed values for size_unit / unit are in src/lib/products.ts and enforced
 * by check constraints here.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    price: money("price").notNull(),
    sizeValue: numeric("size_value", { precision: 10, scale: 3 }).notNull(),
    sizeUnit: text("size_unit").notNull(),
    // Optional (null = not set).
    unit: text("unit"),
    hsnCode: text("hsn_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    tenantIndex("products", t.organizationId),
    check("products_price_check", sql`${t.price} >= 0`),
    check("products_size_value_check", sql`${t.sizeValue} > 0`),
    check("products_size_unit_check", sql`${t.sizeUnit} in ('g', 'kg', 'ml', 'l')`),
    check("products_unit_check", sql`${t.unit} in ('bag', 'piece', 'packet', 'crate')`),
    check("products_hsn_code_check", sql`${t.hsnCode} ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$'`),
  ],
);

/**
 * A customer shop the business supplies (a retailer on the delivery route).
 * Shops belong to the business, not to one store.
 *
 *   mobile  owner's mobile number, stored normalized (see normalizePhone).
 */
export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    firmName: text("firm_name").notNull(),
    firmAddress: text("firm_address").notNull(),
    ownerName: text("owner_name").notNull(),
    mobile: text("mobile").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [tenantIndex("shops", t.organizationId)],
);

/**
 * A delivery vehicle of the business.
 *
 *   number  registration number, stored normalized: uppercase letters and
 *           digits only (e.g. "MH12AB1234", "22BH1234AA"). Unique per business.
 *   type    one of VEHICLE_TYPES in src/lib/vehicles.ts (check constraint).
 */
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    number: text("number").notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    tenantIndex("vehicles", t.organizationId),
    // A registration number is unique within a business, not globally.
    uniqueIndex("vehicles_organization_id_number_key").on(t.organizationId, t.number),
    check("vehicles_number_check", sql`${t.number} ~ '^[A-Z0-9]{6,11}$'`),
    check("vehicles_type_check", sql`${t.type} in ('bike', 'auto', 'pickup', 'truck', 'van', 'other')`),
  ],
);

/**
 * App fields for an employee. The employee is a Neon Auth user who is a
 * "member" of the business (see CONVENTIONS.md, Roles); their name lives on
 * neon_auth.user. One row per employee user.
 *
 *   phone        login phone, stored normalized (see normalizePhone). Unique
 *                across all employees; src/lib/employee-actions.ts also checks
 *                it isn't an owner's business_phone, since both are login ids.
 *   designation  job title shown on the Employees page, e.g. "Driver".
 *
 * The employee's neon_auth.user email is a generated placeholder: employees
 * sign in with phone + password only.
 */
export const employeeProfile = pgTable(
  "employee_profile",
  {
    userId: uuid("user_id").primaryKey(),
    organizationId: organizationId(),
    phone: text("phone").notNull(),
    designation: text("designation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [tenantIndex("employee_profile", t.organizationId), uniqueIndex("employee_profile_phone_key").on(t.phone)],
);

/* ------------------------------------------------------------------ */
/* Deliveries, payments and stock                                     */
/* ------------------------------------------------------------------ */

/**
 * A delivery is the order: goods from one store to one shop.
 *
 *   number         human-friendly sequence per business (#1, #2, …).
 *   status         pending → out_for_delivery → delivered, or cancelled
 *                  (DELIVERY_STATUSES in src/lib/deliveries.ts).
 *   scheduled_for  the day it's planned for (business day in India time).
 *   assigned_to    the employee (neon_auth user id) doing the delivery.
 *   total          sum of its items' line totals, kept in sync by the server.
 *   delivered_at   set when it becomes "delivered"; sales count on this date.
 *
 * Delivered deliveries add to the shop's balance; payments reduce it (see
 * src/lib/ledger-data.ts).
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    number: integer("number").notNull(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to"),
    status: text("status").notNull().default("pending"),
    scheduledFor: date("scheduled_for", { mode: "string" })
      .notNull()
      .default(sql`(now() at time zone 'Asia/Kolkata')::date`),
    total: money("total").notNull().default("0"),
    notes: text("notes"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    tenantIndex("deliveries", t.organizationId),
    uniqueIndex("deliveries_organization_id_number_key").on(t.organizationId, t.number),
    index("deliveries_organization_id_store_id_scheduled_for_idx").on(t.organizationId, t.storeId, t.scheduledFor),
    index("deliveries_organization_id_delivered_at_idx").on(t.organizationId, t.deliveredAt),
    index("deliveries_shop_id_idx").on(t.shopId),
    check("deliveries_status_check", sql`${t.status} in ('pending', 'out_for_delivery', 'delivered', 'cancelled')`),
    check("deliveries_total_check", sql`${t.total} >= 0`),
    check("deliveries_delivered_at_check", sql`(${t.status} = 'delivered') = (${t.deliveredAt} is not null)`),
  ],
);

/**
 * One product line on a delivery. Name and price are copied from the product
 * when the line is saved, so editing or deleting the product later never
 * changes past deliveries.
 */
export const deliveryItems = pgTable(
  "delivery_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitPrice: money("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    tenantIndex("delivery_items", t.organizationId),
    index("delivery_items_delivery_id_idx").on(t.deliveryId),
    index("delivery_items_product_id_idx").on(t.productId),
    check("delivery_items_quantity_check", sql`${t.quantity} > 0`),
    check("delivery_items_unit_price_check", sql`${t.unitPrice} >= 0`),
  ],
);

/**
 * Money received from a shop. Reduces the shop's outstanding balance.
 *
 *   method       cash, upi, cheque or bank (PAYMENT_METHODS in src/lib/payments.ts).
 *   received_by  the user who recorded it (owner or employee).
 *   delivery_id  set when collected on a delivery (optional).
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    deliveryId: uuid("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    receivedOn: date("received_on", { mode: "string" })
      .notNull()
      .default(sql`(now() at time zone 'Asia/Kolkata')::date`),
    receivedBy: uuid("received_by").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantIndex("payments", t.organizationId),
    index("payments_shop_id_idx").on(t.shopId),
    index("payments_organization_id_received_on_idx").on(t.organizationId, t.receivedOn),
    check("payments_amount_check", sql`${t.amount} > 0`),
    check("payments_method_check", sql`${t.method} in ('cash', 'upi', 'cheque', 'bank')`),
  ],
);

/**
 * Stock of one product in one store. Delivering a delivery takes its items
 * out of the delivery's store (quantity may go below 0 if stock wasn't kept
 * up to date; the Stock page shows that).
 *
 *   low_stock_at  show a "low stock" warning at or below this quantity.
 */
export const stock = pgTable(
  "stock",
  {
    organizationId: organizationId(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    lowStockAt: integer("low_stock_at").notNull().default(10),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.productId] }),
    tenantIndex("stock", t.organizationId),
    check("stock_low_stock_at_check", sql`${t.lowStockAt} >= 0`),
  ],
);
