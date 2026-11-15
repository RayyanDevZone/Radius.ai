import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizationId, tenantIndex } from "./tenant";

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
