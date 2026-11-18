import { sql } from "drizzle-orm";
import { check, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
